import "server-only";

import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import WebSocket, { type RawData } from "ws";
import type {
  SpeechToTextProvider,
  TranscriptionInput,
  TranscriptionResult,
} from "@/lib/providers/contracts";
import {
  MAX_TRANSCRIPTION_AUDIO_BYTES,
  TranscriptionResultSchema,
} from "@/lib/speech/schemas";

const VOLC_STT_ENDPOINT =
  "wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_nostream";
const DEFAULT_RESOURCE_ID = "volc.seedasr.sauc.duration";
const PROVIDER_NAME = "volcengine-doubao-seed-asr-2.0";
const REQUEST_TIMEOUT_MS = 45_000;
const HANDSHAKE_TIMEOUT_MS = 15_000;
const AUDIO_SEGMENT_BYTES = 6_400;

const MESSAGE_TYPE = {
  clientFullRequest: 0b0001,
  clientAudioOnly: 0b0010,
  serverFullResponse: 0b1001,
  serverError: 0b1111,
} as const;

const FLAGS = {
  positiveSequence: 0b0001,
  negativeWithSequence: 0b0011,
} as const;

type VolcSttConfiguration = Readonly<{
  endpoint: string;
  headers: Record<string, string>;
  resourceId: string;
  uid: string;
}>;

type PcmAudio = Readonly<{
  bytes: Buffer;
  durationMs: number;
}>;

type ParsedServerFrame = Readonly<{
  errorCode?: number;
  isLast: boolean;
  messageType: number;
  payload?: unknown;
}>;

export type VolcSttErrorCode =
  | "INVALID_AUDIO"
  | "REQUEST_TOO_LARGE"
  | "UNSUPPORTED_AUDIO"
  | "NO_SPEECH"
  | "NOT_CONFIGURED"
  | "UPSTREAM_TIMEOUT"
  | "UPSTREAM_BUSY"
  | "UPSTREAM_UNAVAILABLE"
  | "INVALID_RESPONSE";

export class VolcSttError extends Error {
  readonly code: VolcSttErrorCode;

  constructor(code: VolcSttErrorCode) {
    super(code);
    this.name = "VolcSttError";
    this.code = code;
  }
}

function firstConfiguredValue(...values: Array<string | undefined>) {
  return values.map((value) => value?.trim()).find(Boolean);
}

function getConfiguration(): VolcSttConfiguration {
  const apiKey = firstConfiguredValue(
    process.env.VOLC_STT_API_KEY,
    process.env.VOLC_SPEECH_API_KEY,
    process.env.STT_API_KEY,
  );
  const appKey = firstConfiguredValue(
    process.env.VOLC_STT_APP_KEY,
    process.env.VOLC_SPEECH_APP_KEY,
    process.env.STT_APP_KEY,
  );
  const accessKey = firstConfiguredValue(
    process.env.VOLC_STT_ACCESS_KEY,
    process.env.VOLC_SPEECH_ACCESS_KEY,
    process.env.STT_ACCESS_KEY,
  );
  const endpoint =
    firstConfiguredValue(process.env.VOLC_STT_ENDPOINT) ?? VOLC_STT_ENDPOINT;
  const resourceId =
    firstConfiguredValue(process.env.VOLC_STT_RESOURCE_ID) ??
    DEFAULT_RESOURCE_ID;
  const uid =
    firstConfiguredValue(process.env.VOLC_SPEECH_UID) ?? "ai-interview";

  if (apiKey) {
    return {
      endpoint,
      headers: { "X-Api-Key": apiKey },
      resourceId,
      uid,
    };
  }

  if (appKey && accessKey) {
    return {
      endpoint,
      headers: {
        "X-Api-App-Key": appKey,
        "X-Api-Access-Key": accessKey,
      },
      resourceId,
      uid,
    };
  }

  throw new VolcSttError("NOT_CONFIGURED");
}

function hasAscii(bytes: Uint8Array, offset: number, value: string) {
  if (offset + value.length > bytes.byteLength) return false;
  return Array.from(value).every(
    (character, index) => bytes[offset + index] === character.charCodeAt(0),
  );
}

function parsePcm16kMonoWave(bytes: Uint8Array): PcmAudio | null {
  if (
    bytes.byteLength < 44 ||
    !hasAscii(bytes, 0, "RIFF") ||
    !hasAscii(bytes, 8, "WAVE")
  ) {
    return null;
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const riffEnd = view.getUint32(4, true) + 8;
  if (riffEnd < 44 || riffEnd > bytes.byteLength) return null;

  let isExpectedFormat = false;
  let pcmBytes: Buffer | null = null;
  let offset = 12;

  while (offset + 8 <= riffEnd) {
    const chunkSize = view.getUint32(offset + 4, true);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkSize;
    if (chunkEnd > riffEnd) return null;

    if (hasAscii(bytes, offset, "fmt ")) {
      if (chunkSize < 16) return null;
      isExpectedFormat =
        view.getUint16(chunkStart, true) === 1 &&
        view.getUint16(chunkStart + 2, true) === 1 &&
        view.getUint32(chunkStart + 4, true) === 16_000 &&
        view.getUint16(chunkStart + 12, true) === 2 &&
        view.getUint16(chunkStart + 14, true) === 16;
    }

    if (hasAscii(bytes, offset, "data")) {
      if (chunkSize === 0 || chunkSize % 2 !== 0) return null;
      pcmBytes = Buffer.from(
        bytes.buffer,
        bytes.byteOffset + chunkStart,
        chunkSize,
      );
    }

    offset = chunkEnd + (chunkSize % 2);
  }

  if (!isExpectedFormat || !pcmBytes) return null;
  return {
    bytes: pcmBytes,
    durationMs: Math.round(pcmBytes.byteLength / 32),
  };
}

async function readAndValidateAudio(audio: Blob): Promise<PcmAudio> {
  if (audio.size === 0) {
    throw new VolcSttError("INVALID_AUDIO");
  }
  if (audio.size > MAX_TRANSCRIPTION_AUDIO_BYTES) {
    throw new VolcSttError("REQUEST_TOO_LARGE");
  }

  const normalizedMimeType = audio.type
    .split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  if (
    normalizedMimeType !== "audio/wav" &&
    normalizedMimeType !== "audio/wave" &&
    normalizedMimeType !== "audio/x-wav"
  ) {
    throw new VolcSttError("UNSUPPORTED_AUDIO");
  }

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await audio.arrayBuffer());
  } catch {
    throw new VolcSttError("INVALID_AUDIO");
  }

  const pcm = parsePcm16kMonoWave(bytes);
  if (!pcm) {
    throw new VolcSttError("INVALID_AUDIO");
  }
  return pcm;
}

function buildHeader(messageType: number, flags: number, serialization: number) {
  return Buffer.from([
    0x11,
    (messageType << 4) | flags,
    (serialization << 4) | 0x01,
    0x00,
  ]);
}

function buildFullClientRequest(sequence: number, payload: unknown) {
  const compressed = gzipSync(Buffer.from(JSON.stringify(payload), "utf8"));
  const metadata = Buffer.alloc(8);
  metadata.writeInt32BE(sequence, 0);
  metadata.writeUInt32BE(compressed.byteLength, 4);
  return Buffer.concat([
    buildHeader(
      MESSAGE_TYPE.clientFullRequest,
      FLAGS.positiveSequence,
      0b0001,
    ),
    metadata,
    compressed,
  ]);
}

function buildAudioRequest(sequence: number, audio: Buffer, isLast: boolean) {
  const compressed = gzipSync(audio);
  const metadata = Buffer.alloc(8);
  metadata.writeInt32BE(isLast ? -sequence : sequence, 0);
  metadata.writeUInt32BE(compressed.byteLength, 4);
  return Buffer.concat([
    buildHeader(
      MESSAGE_TYPE.clientAudioOnly,
      isLast ? FLAGS.negativeWithSequence : FLAGS.positiveSequence,
      0b0000,
    ),
    metadata,
    compressed,
  ]);
}

function decodePayload(
  serialization: number,
  compression: number,
  payload: Buffer,
) {
  const decoded = compression === 0b0001 ? gunzipSync(payload) : payload;
  if (serialization === 0b0001) {
    return JSON.parse(decoded.toString("utf8")) as unknown;
  }
  return decoded;
}

function parseServerFrame(rawData: RawData): ParsedServerFrame {
  const frame = Array.isArray(rawData)
    ? Buffer.concat(rawData)
    : Buffer.isBuffer(rawData)
      ? rawData
      : Buffer.from(rawData);
  if (frame.byteLength < 8) {
    throw new VolcSttError("INVALID_RESPONSE");
  }

  const headerSize = (frame[0]! & 0x0f) * 4;
  const messageType = frame[1]! >> 4;
  const flags = frame[1]! & 0x0f;
  const serialization = frame[2]! >> 4;
  const compression = frame[2]! & 0x0f;
  let offset = headerSize;

  if (flags & 0x01) offset += 4;
  const isLast = Boolean(flags & 0x02);

  if (messageType === MESSAGE_TYPE.serverFullResponse) {
    if (offset + 4 > frame.byteLength) {
      throw new VolcSttError("INVALID_RESPONSE");
    }
    const payloadSize = frame.readUInt32BE(offset);
    offset += 4;
    if (offset + payloadSize > frame.byteLength) {
      throw new VolcSttError("INVALID_RESPONSE");
    }
    return {
      isLast,
      messageType,
      payload: decodePayload(
        serialization,
        compression,
        frame.subarray(offset, offset + payloadSize),
      ),
    };
  }

  if (messageType === MESSAGE_TYPE.serverError) {
    if (offset + 8 > frame.byteLength) {
      throw new VolcSttError("INVALID_RESPONSE");
    }
    const errorCode = frame.readInt32BE(offset);
    offset += 4;
    const payloadSize = frame.readUInt32BE(offset);
    offset += 4;
    return {
      errorCode,
      isLast: true,
      messageType,
      payload:
        offset + payloadSize <= frame.byteLength
          ? decodePayload(
              serialization,
              compression,
              frame.subarray(offset, offset + payloadSize),
            )
          : undefined,
    };
  }

  return { isLast, messageType };
}

function extractText(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const result = (payload as { result?: unknown }).result;
  if (!result || typeof result !== "object") return "";
  const text = (result as { text?: unknown }).text;
  return typeof text === "string" ? text.trim() : "";
}

function classifyProtocolFailure(errorCode: number | undefined) {
  if (errorCode === 1013 || errorCode === 20000003) return "NO_SPEECH";
  if (errorCode === 55000031) return "UPSTREAM_BUSY";
  return "UPSTREAM_UNAVAILABLE";
}

function reportSafeProviderFailure(details: {
  errorCode?: number;
  httpStatus?: number;
  logId?: string;
  requestId: string;
}) {
  console.error("Volc streaming STT request failed", details);
}

function sendFrame(socket: WebSocket, frame: Buffer) {
  return new Promise<void>((resolve, reject) => {
    socket.send(frame, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function transcribePcmWithVolc(
  pcm: PcmAudio,
  input: TranscriptionInput,
  configuration: VolcSttConfiguration,
) {
  const connectId = randomUUID();
  let logId: string | undefined;
  let handshakeStatus: number | undefined;
  let finalText = "";
  let protocolErrorCode: number | undefined;

  const socket = new WebSocket(configuration.endpoint, {
    handshakeTimeout: HANDSHAKE_TIMEOUT_MS,
    headers: {
      ...configuration.headers,
      "X-Api-Connect-Id": connectId,
      "X-Api-Request-Id": input.requestId,
      "X-Api-Resource-Id": configuration.resourceId,
      "X-Api-Sequence": "-1",
    },
  });

  socket.on("upgrade", (response) => {
    const rawLogId = response.headers["x-tt-logid"];
    logId = Array.isArray(rawLogId) ? rawLogId[0] : rawLogId;
  });
  socket.on("unexpected-response", (_request, response) => {
    handshakeStatus = response.statusCode;
  });

  const completion = new Promise<string>((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      callback();
    };
    const timeout = setTimeout(() => {
      finish(() => reject(new VolcSttError("UPSTREAM_TIMEOUT")));
      socket.terminate();
    }, REQUEST_TIMEOUT_MS);

    socket.on("message", (rawData) => {
      try {
        const frame = parseServerFrame(rawData);
        if (frame.messageType === MESSAGE_TYPE.serverError) {
          protocolErrorCode = frame.errorCode;
          finish(() =>
            reject(
              new VolcSttError(classifyProtocolFailure(frame.errorCode)),
            ),
          );
          socket.close();
          return;
        }

        const text = extractText(frame.payload);
        if (text) finalText = text;
        if (frame.isLast) {
          finish(() => resolve(finalText));
          socket.close();
        }
      } catch (error) {
        finish(() =>
          reject(
            error instanceof VolcSttError
              ? error
              : new VolcSttError("INVALID_RESPONSE"),
          ),
        );
      }
    });

    socket.on("error", () => {
      finish(() => reject(new VolcSttError("UPSTREAM_UNAVAILABLE")));
    });

    socket.on("close", () => {
      if (!settled) {
        finish(() => reject(new VolcSttError("UPSTREAM_UNAVAILABLE")));
      }
    });
  });
  void completion.catch(() => undefined);

  try {
    await new Promise<void>((resolve, reject) => {
      socket.once("open", () => resolve());
      socket.once("error", () =>
        reject(new VolcSttError("UPSTREAM_UNAVAILABLE")),
      );
    });

    let sequence = 1;
    await sendFrame(
      socket,
      buildFullClientRequest(sequence, {
        user: { uid: configuration.uid },
        audio: {
          format: "pcm",
          codec: "raw",
          rate: 16_000,
          bits: 16,
          channel: 1,
        },
        request: {
          model_name: "bigmodel",
          enable_itn: true,
          enable_punc: true,
          result_type: "full",
        },
      }),
    );

    for (let offset = 0; offset < pcm.bytes.byteLength; ) {
      sequence += 1;
      const end = Math.min(
        offset + AUDIO_SEGMENT_BYTES,
        pcm.bytes.byteLength,
      );
      await sendFrame(
        socket,
        buildAudioRequest(
          sequence,
          pcm.bytes.subarray(offset, end),
          end === pcm.bytes.byteLength,
        ),
      );
      offset = end;
    }

    const text = await completion;
    if (!text) throw new VolcSttError("NO_SPEECH");
    return text;
  } catch (error) {
    reportSafeProviderFailure({
      errorCode: protocolErrorCode,
      httpStatus: handshakeStatus,
      logId,
      requestId: input.requestId,
    });
    if (error instanceof VolcSttError) throw error;
    throw new VolcSttError("UPSTREAM_UNAVAILABLE");
  } finally {
    if (
      socket.readyState === WebSocket.OPEN ||
      socket.readyState === WebSocket.CONNECTING
    ) {
      socket.terminate();
    }
  }
}

export async function transcribeWithVolc(
  input: TranscriptionInput,
): Promise<TranscriptionResult> {
  const pcm = await readAndValidateAudio(input.audio);
  const configuration = getConfiguration();
  const rawText = await transcribePcmWithVolc(pcm, input, configuration);

  return TranscriptionResultSchema.parse({
    requestId: input.requestId,
    rawText,
    provider: PROVIDER_NAME,
    durationMs: pcm.durationMs,
  });
}

export const volcSpeechToTextProvider: SpeechToTextProvider = {
  mode: "live",
  transcribe: transcribeWithVolc,
};
