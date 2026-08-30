import "server-only";

import { Buffer } from "node:buffer";
import { z } from "zod";

const DEFAULT_VOLC_TTS_ENDPOINT =
  "https://openspeech.bytedance.com/api/v3/tts/unidirectional";
const DEFAULT_VOLC_TTS_RESOURCE_ID = "seed-tts-2.0";
const DEFAULT_VOLC_TTS_FORMAT = "mp3";
const DEFAULT_VOLC_TTS_SAMPLE_RATE = 24_000;
const DEFAULT_VOLC_SPEECH_UID = "ai-interview";
const VOLC_TTS_HOSTNAME = "openspeech.bytedance.com";
const SUPPORTED_SAMPLE_RATES = new Set([
  8_000, 16_000, 22_050, 24_000, 32_000, 44_100, 48_000,
]);
const REQUEST_TIMEOUT_MS = 18_000;
const MAX_STREAM_BYTES = 24 * 1024 * 1024;
const MAX_AUDIO_BYTES = 16 * 1024 * 1024;

const VolcTtsChunkSchema = z
  .object({
    code: z.union([z.number().int(), z.string().min(1)]),
    data: z.string().nullable().optional(),
    message: z.string().optional(),
    sequence: z.number().int().optional(),
  })
  .passthrough();

type VolcTtsConfiguration = Readonly<{
  apiKey: string;
  endpoint: string;
  format: "mp3";
  resourceId: string;
  sampleRate: number;
  speaker: string;
  uid: string;
}>;

export type VolcTtsErrorCode =
  | "NOT_CONFIGURED"
  | "UPSTREAM_TIMEOUT"
  | "UPSTREAM_BUSY"
  | "UPSTREAM_UNAVAILABLE"
  | "INVALID_RESPONSE";

export class VolcTtsError extends Error {
  readonly code: VolcTtsErrorCode;

  constructor(code: VolcTtsErrorCode) {
    super(code);
    this.name = "VolcTtsError";
    this.code = code;
  }
}

function configuredValue(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function parseEndpoint(value: string) {
  let endpoint: URL;
  try {
    endpoint = new URL(value);
  } catch {
    throw new VolcTtsError("NOT_CONFIGURED");
  }

  if (
    endpoint.protocol !== "https:" ||
    endpoint.hostname !== VOLC_TTS_HOSTNAME ||
    (endpoint.port !== "" && endpoint.port !== "443") ||
    endpoint.username !== "" ||
    endpoint.password !== ""
  ) {
    throw new VolcTtsError("NOT_CONFIGURED");
  }
  return endpoint.toString();
}

function getConfiguration(): VolcTtsConfiguration {
  const apiKey =
    configuredValue(process.env.VOLC_SPEECH_API_KEY) ??
    configuredValue(process.env.VOLC_TTS_API_KEY);
  const endpoint = parseEndpoint(
    configuredValue(process.env.VOLC_TTS_ENDPOINT) ??
      DEFAULT_VOLC_TTS_ENDPOINT,
  );
  const format =
    configuredValue(process.env.VOLC_TTS_FORMAT) ?? DEFAULT_VOLC_TTS_FORMAT;
  const resourceId =
    configuredValue(process.env.VOLC_TTS_RESOURCE_ID) ??
    DEFAULT_VOLC_TTS_RESOURCE_ID;
  const rawSampleRate =
    configuredValue(process.env.VOLC_TTS_SAMPLE_RATE) ??
    String(DEFAULT_VOLC_TTS_SAMPLE_RATE);
  const sampleRate = Number(rawSampleRate);
  const speaker = configuredValue(process.env.VOLC_TTS_SPEAKER);
  const uid =
    configuredValue(process.env.VOLC_SPEECH_UID) ?? DEFAULT_VOLC_SPEECH_UID;

  if (
    !apiKey ||
    format !== "mp3" ||
    !/^[A-Za-z0-9._:-]{1,160}$/u.test(resourceId) ||
    !/^\d{4,6}$/u.test(rawSampleRate) ||
    !Number.isSafeInteger(sampleRate) ||
    !SUPPORTED_SAMPLE_RATES.has(sampleRate) ||
    !speaker ||
    speaker.length > 160 ||
    !/^[A-Za-z0-9_.:-]+$/u.test(speaker) ||
    uid.length > 128 ||
    /[\u0000-\u001f\u007f]/u.test(uid)
  ) {
    throw new VolcTtsError("NOT_CONFIGURED");
  }

  return {
    apiKey,
    endpoint,
    format,
    resourceId,
    sampleRate,
    speaker,
    uid,
  };
}

function classifyHttpFailure(status: number): VolcTtsErrorCode {
  if (status === 408 || status === 429 || status === 503) {
    return "UPSTREAM_BUSY";
  }
  return "UPSTREAM_UNAVAILABLE";
}

function reportSafeProviderFailure(details: {
  httpStatus: number | null;
  logId: string | null;
  providerStatus: string | null;
  requestId: string;
}) {
  console.error("Volc TTS request failed", details);
}

function extractJsonObjects(input: string, final: boolean) {
  const objects: string[] = [];
  let cursor = 0;

  while (cursor < input.length) {
    while (cursor < input.length && /\s/u.test(input[cursor]!)) {
      cursor += 1;
    }
    if (cursor === input.length) {
      return { objects, remainder: "" };
    }
    if (input[cursor] !== "{") {
      throw new VolcTtsError("INVALID_RESPONSE");
    }

    const objectStart = cursor;
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (; cursor < input.length; cursor += 1) {
      const character = input[cursor]!;

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (character === "\\") {
          escaped = true;
        } else if (character === '"') {
          inString = false;
        }
        continue;
      }

      if (character === '"') {
        inString = true;
      } else if (character === "{") {
        depth += 1;
      } else if (character === "}") {
        depth -= 1;
        if (depth < 0) {
          throw new VolcTtsError("INVALID_RESPONSE");
        }
        if (depth === 0) {
          objects.push(input.slice(objectStart, cursor + 1));
          cursor += 1;
          break;
        }
      }
    }

    if (depth !== 0 || inString) {
      if (final) {
        throw new VolcTtsError("INVALID_RESPONSE");
      }
      return { objects, remainder: input.slice(objectStart) };
    }
  }

  return { objects, remainder: "" };
}

function decodeBase64(value: string) {
  if (
    value.length === 0 ||
    value.length % 4 === 1 ||
    !/^[A-Za-z0-9+/]*={0,2}$/u.test(value) ||
    value.slice(0, -2).includes("=")
  ) {
    throw new VolcTtsError("INVALID_RESPONSE");
  }

  const paddingLength = (4 - (value.length % 4)) % 4;
  const paddedValue = value + "=".repeat(paddingLength);
  const decoded = Buffer.from(paddedValue, "base64");
  if (decoded.byteLength === 0) {
    throw new VolcTtsError("INVALID_RESPONSE");
  }
  return decoded;
}

function isMp3(bytes: Uint8Array) {
  const hasId3Header =
    bytes.byteLength >= 3 &&
    bytes[0] === 0x49 &&
    bytes[1] === 0x44 &&
    bytes[2] === 0x33;
  const hasMp3FrameHeader =
    bytes.byteLength >= 2 &&
    bytes[0] === 0xff &&
    (bytes[1]! & 0xe0) === 0xe0;
  return hasId3Header || hasMp3FrameHeader;
}

async function readAudioStream(response: Response) {
  if (!response.body) {
    throw new VolcTtsError("INVALID_RESPONSE");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const audioChunks: Buffer[] = [];
  let audioBytes = 0;
  let streamBytes = 0;
  let pending = "";
  let sawFinalChunk = false;

  const handleJsonObject = (rawObject: string) => {
    let value: unknown;
    try {
      value = JSON.parse(rawObject);
    } catch {
      throw new VolcTtsError("INVALID_RESPONSE");
    }

    const parsed = VolcTtsChunkSchema.safeParse(value);
    if (!parsed.success) {
      throw new VolcTtsError("INVALID_RESPONSE");
    }

    const code = String(parsed.data.code);
    if (code === "20000000") {
      sawFinalChunk = true;
      return;
    }
    if (code !== "0" && code !== "3000") {
      throw new VolcTtsError("UPSTREAM_UNAVAILABLE");
    }
    if (!parsed.data.data) {
      return;
    }

    const audioChunk = decodeBase64(parsed.data.data);
    audioBytes += audioChunk.byteLength;
    if (audioBytes > MAX_AUDIO_BYTES) {
      throw new VolcTtsError("INVALID_RESPONSE");
    }
    audioChunks.push(audioChunk);
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      streamBytes += value.byteLength;
      if (streamBytes > MAX_STREAM_BYTES) {
        throw new VolcTtsError("INVALID_RESPONSE");
      }

      pending += decoder.decode(value, { stream: true });
      const parsed = extractJsonObjects(pending, false);
      pending = parsed.remainder;
      for (const rawObject of parsed.objects) {
        handleJsonObject(rawObject);
      }
    }

    pending += decoder.decode();
    const parsed = extractJsonObjects(pending, true);
    for (const rawObject of parsed.objects) {
      handleJsonObject(rawObject);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    if (error instanceof VolcTtsError) throw error;
    throw new VolcTtsError("INVALID_RESPONSE");
  }

  if (!sawFinalChunk || audioChunks.length === 0) {
    throw new VolcTtsError("INVALID_RESPONSE");
  }

  const audio = Buffer.concat(audioChunks, audioBytes);
  if (!isMp3(audio)) {
    throw new VolcTtsError("INVALID_RESPONSE");
  }
  return audio;
}

export async function synthesizeWithVolc(input: {
  requestId: string;
  text: string;
}) {
  const configuration = getConfiguration();
  const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(configuration.endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Api-Key": configuration.apiKey,
        "X-Api-Resource-Id": configuration.resourceId,
        "X-Api-Request-Id": input.requestId,
      },
      body: JSON.stringify({
        user: { uid: configuration.uid },
        req_params: {
          text: input.text,
          speaker: configuration.speaker,
          audio_params: {
            format: configuration.format,
            sample_rate: configuration.sampleRate,
          },
        },
      }),
      cache: "no-store",
      redirect: "error",
      signal: timeoutSignal,
    });
  } catch {
    if (timeoutSignal.aborted) {
      throw new VolcTtsError("UPSTREAM_TIMEOUT");
    }
    reportSafeProviderFailure({
      httpStatus: null,
      logId: null,
      providerStatus: null,
      requestId: input.requestId,
    });
    throw new VolcTtsError("UPSTREAM_UNAVAILABLE");
  }

  const providerStatus = response.headers.get("X-Api-Status-Code");
  const logId = response.headers.get("X-Tt-Logid");
  const headerReportsFailure =
    providerStatus !== null &&
    providerStatus !== "0" &&
    providerStatus !== "20000000";
  if (!response.ok || headerReportsFailure) {
    reportSafeProviderFailure({
      httpStatus: response.status,
      logId,
      providerStatus,
      requestId: input.requestId,
    });
    throw new VolcTtsError(classifyHttpFailure(response.status));
  }

  try {
    return await readAudioStream(response);
  } catch (error) {
    if (timeoutSignal.aborted) {
      throw new VolcTtsError("UPSTREAM_TIMEOUT");
    }
    if (error instanceof VolcTtsError) throw error;
    throw new VolcTtsError("INVALID_RESPONSE");
  }
}
