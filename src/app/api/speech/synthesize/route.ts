import { randomUUID } from "node:crypto";
import { z } from "zod";
import { SpeechRequestIdSchema } from "@/lib/speech/schemas";
import {
  streamSynthesisWithVolc,
  VolcTtsError,
  type VolcTtsErrorCode,
} from "@/lib/speech/volc-tts.server";
import { reserveSpeechRequest } from "@/lib/speech/request-guard.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_TEXT_CHARACTERS = 500;
const MAX_REQUEST_BYTES = 8 * 1024;
const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
} as const;

const SynthesisRequestSchema = z
  .object({
    requestId: SpeechRequestIdSchema.optional(),
    text: z
      .string()
      .trim()
      .min(1)
      .refine((value) => Array.from(value).length <= MAX_TEXT_CHARACTERS)
      .refine(
        (value) =>
          !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value),
      ),
  })
  .strict();

type SynthesisErrorCode =
  | "INVALID_INPUT"
  | "REQUEST_TOO_LARGE"
  | "TTS_NOT_CONFIGURED"
  | "TTS_TIMEOUT"
  | "TTS_BUSY"
  | "TTS_UNAVAILABLE"
  | "TTS_RESPONSE_INVALID";

const ERROR_DETAILS: Record<
  SynthesisErrorCode,
  { message: string; recoverable: boolean; status: number }
> = {
  INVALID_INPUT: {
    message: "请提交 1 至 500 个字符的有效朗读文本。",
    recoverable: true,
    status: 400,
  },
  REQUEST_TOO_LARGE: {
    message: "朗读请求过大，请缩短文本后重试。",
    recoverable: true,
    status: 413,
  },
  TTS_NOT_CONFIGURED: {
    message: "语音合成服务尚未配置，请检查服务配置。",
    recoverable: true,
    status: 503,
  },
  TTS_TIMEOUT: {
    message: "语音合成超时，请稍后重试。",
    recoverable: true,
    status: 504,
  },
  TTS_BUSY: {
    message: "语音合成服务繁忙，请稍后重试。",
    recoverable: true,
    status: 503,
  },
  TTS_UNAVAILABLE: {
    message: "语音合成服务暂时不可用，请稍后重试。",
    recoverable: true,
    status: 502,
  },
  TTS_RESPONSE_INVALID: {
    message: "本次语音合成结果无效，请稍后重试。",
    recoverable: true,
    status: 502,
  },
};

const PROVIDER_ERROR_CODES: Record<VolcTtsErrorCode, SynthesisErrorCode> = {
  NOT_CONFIGURED: "TTS_NOT_CONFIGURED",
  UPSTREAM_TIMEOUT: "TTS_TIMEOUT",
  UPSTREAM_BUSY: "TTS_BUSY",
  UPSTREAM_UNAVAILABLE: "TTS_UNAVAILABLE",
  INVALID_RESPONSE: "TTS_RESPONSE_INVALID",
};

function errorResponse(code: SynthesisErrorCode, requestId: string) {
  const details = ERROR_DETAILS[code];
  return Response.json(
    {
      ok: false,
      code,
      message: details.message,
      recoverable: details.recoverable,
      requestId,
    },
    {
      status: details.status,
      headers: {
        ...NO_STORE_HEADERS,
        ...(code === "TTS_BUSY" ? { "Retry-After": "5" } : {}),
        "X-Request-Id": requestId,
      },
    },
  );
}

async function readBoundedJson(request: Request): Promise<unknown> {
  if (!request.body) {
    throw new VolcTtsError("INVALID_RESPONSE");
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    totalBytes += value.byteLength;
    if (totalBytes > MAX_REQUEST_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new RangeError("REQUEST_TOO_LARGE");
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const rawBody = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return JSON.parse(rawBody) as unknown;
  } catch {
    throw new SyntaxError("INVALID_JSON");
  }
}

export async function POST(request: Request) {
  const fallbackRequestId = randomUUID();
  const contentType = request.headers.get("content-type")?.toLowerCase();
  if (
    !contentType ||
    !/^application\/json(?:\s*;\s*charset=(?:utf-8|"utf-8"))?\s*$/u.test(
      contentType,
    )
  ) {
    return errorResponse("INVALID_INPUT", fallbackRequestId);
  }

  const rawContentLength = request.headers.get("content-length");
  if (rawContentLength) {
    const contentLength = Number(rawContentLength);
    if (!Number.isSafeInteger(contentLength) || contentLength < 0) {
      return errorResponse("INVALID_INPUT", fallbackRequestId);
    }
    if (contentLength > MAX_REQUEST_BYTES) {
      return errorResponse("REQUEST_TOO_LARGE", fallbackRequestId);
    }
  }

  let rawBody: unknown;
  try {
    rawBody = await readBoundedJson(request);
  } catch (error) {
    return errorResponse(
      error instanceof RangeError ? "REQUEST_TOO_LARGE" : "INVALID_INPUT",
      fallbackRequestId,
    );
  }

  const parsedRequest = SynthesisRequestSchema.safeParse(rawBody);
  if (!parsedRequest.success) {
    return errorResponse("INVALID_INPUT", fallbackRequestId);
  }

  const requestId = parsedRequest.data.requestId ?? fallbackRequestId;
  const releaseRequest = reserveSpeechRequest("tts");
  if (!releaseRequest) {
    return errorResponse("TTS_BUSY", requestId);
  }

  try {
    const providerStream = await streamSynthesisWithVolc({
      requestId,
      text: parsedRequest.data.text,
    });
    const providerReader = providerStream.getReader();
    let released = false;
    const releaseOnce = () => {
      if (released) return;
      released = true;
      releaseRequest();
    };
    const responseStream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const { done, value } = await providerReader.read();
          if (done) {
            releaseOnce();
            controller.close();
            return;
          }
          controller.enqueue(value);
        } catch (error) {
          releaseOnce();
          controller.error(error);
        }
      },
      async cancel(reason) {
        try {
          await providerReader.cancel(reason);
        } finally {
          releaseOnce();
        }
      },
    });

    return new Response(responseStream, {
      status: 200,
      headers: {
        ...NO_STORE_HEADERS,
        "Content-Type": "audio/mpeg",
        "X-Accel-Buffering": "no",
        "X-Request-Id": requestId,
      },
    });
  } catch (error) {
    releaseRequest();
    if (error instanceof VolcTtsError) {
      return errorResponse(PROVIDER_ERROR_CODES[error.code], requestId);
    }
    return errorResponse("TTS_UNAVAILABLE", requestId);
  }
}
