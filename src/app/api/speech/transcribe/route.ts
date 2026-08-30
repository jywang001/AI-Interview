import { randomUUID } from "node:crypto";
import {
  SpeechLocaleSchema,
  SpeechRequestIdSchema,
  SpeechTranscribeErrorSchema,
  TranscriptionResultSchema,
  MAX_TRANSCRIPTION_AUDIO_BYTES,
  type SpeechTranscribeError,
} from "@/lib/speech/schemas";
import {
  transcribeWithVolc,
  VolcSttError,
  type VolcSttErrorCode,
} from "@/lib/speech/volc-stt.server";
import { reserveSpeechRequest } from "@/lib/speech/request-guard.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
} as const;
const MAX_MULTIPART_OVERHEAD_BYTES = 256 * 1024;
const MAX_REQUEST_BYTES =
  MAX_TRANSCRIPTION_AUDIO_BYTES + MAX_MULTIPART_OVERHEAD_BYTES;

const ERROR_DETAILS: Record<
  SpeechTranscribeError["code"],
  { message: string; recoverable: boolean; status: number }
> = {
  INVALID_INPUT: {
    message: "请提交一段有效的录音。",
    recoverable: true,
    status: 400,
  },
  REQUEST_TOO_LARGE: {
    message: "录音不能超过 5 MB，请缩短后重试。",
    recoverable: true,
    status: 413,
  },
  UNSUPPORTED_AUDIO: {
    message: "当前仅支持页面内录制的 WAV 音频。",
    recoverable: true,
    status: 415,
  },
  NO_SPEECH: {
    message: "没有识别到清晰语音，请靠近麦克风后重试。",
    recoverable: true,
    status: 422,
  },
  STT_NOT_CONFIGURED: {
    message: "语音转写服务尚未配置，请联系管理员。",
    recoverable: true,
    status: 503,
  },
  STT_TIMEOUT: {
    message: "语音转写超时，请缩短录音后重试。",
    recoverable: true,
    status: 504,
  },
  STT_BUSY: {
    message: "语音转写服务繁忙，请稍后重试。",
    recoverable: true,
    status: 503,
  },
  STT_UNAVAILABLE: {
    message: "语音转写服务暂时不可用，请稍后重试。",
    recoverable: true,
    status: 502,
  },
  STT_RESPONSE_INVALID: {
    message: "本次语音转写结果无效，请重新录制。",
    recoverable: true,
    status: 502,
  },
};

const PROVIDER_ERROR_CODES: Record<
  VolcSttErrorCode,
  SpeechTranscribeError["code"]
> = {
  INVALID_AUDIO: "INVALID_INPUT",
  REQUEST_TOO_LARGE: "REQUEST_TOO_LARGE",
  UNSUPPORTED_AUDIO: "UNSUPPORTED_AUDIO",
  NO_SPEECH: "NO_SPEECH",
  NOT_CONFIGURED: "STT_NOT_CONFIGURED",
  UPSTREAM_TIMEOUT: "STT_TIMEOUT",
  UPSTREAM_BUSY: "STT_BUSY",
  UPSTREAM_UNAVAILABLE: "STT_UNAVAILABLE",
  INVALID_RESPONSE: "STT_RESPONSE_INVALID",
};

function errorResponse(
  code: SpeechTranscribeError["code"],
  requestId: string,
) {
  const details = ERROR_DETAILS[code];
  const body = SpeechTranscribeErrorSchema.parse({
    ok: false,
    code,
    message: details.message,
    recoverable: details.recoverable,
    requestId,
  });

  return Response.json(body, {
    status: details.status,
    headers: {
      ...NO_STORE_HEADERS,
      ...(code === "STT_BUSY" ? { "Retry-After": "5" } : {}),
    },
  });
}

export async function POST(request: Request) {
  const fallbackRequestId = randomUUID();
  const contentType = request.headers.get("content-type")?.toLowerCase();

  if (!contentType || !/^multipart\/form-data(?:;|$)/u.test(contentType)) {
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

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse("INVALID_INPUT", fallbackRequestId);
  }

  const audioValues = formData.getAll("audio");
  const audio = audioValues[0];
  const rawRequestId = formData.get("requestId");
  const requestIdResult = SpeechRequestIdSchema.safeParse(
    rawRequestId ?? fallbackRequestId,
  );
  const localeResult = SpeechLocaleSchema.safeParse(
    formData.get("locale") ?? "zh-CN",
  );
  if (
    audioValues.length !== 1 ||
    !(audio instanceof File) ||
    !requestIdResult.success ||
    !localeResult.success
  ) {
    return errorResponse("INVALID_INPUT", fallbackRequestId);
  }
  const requestId = requestIdResult.data;
  if (audio.size > MAX_TRANSCRIPTION_AUDIO_BYTES) {
    return errorResponse("REQUEST_TOO_LARGE", requestId);
  }

  const releaseRequest = reserveSpeechRequest("stt");
  if (!releaseRequest) {
    return errorResponse("STT_BUSY", requestId);
  }

  try {
    const result = await transcribeWithVolc({
      audio,
      locale: localeResult.data,
      requestId,
    });
    const body = TranscriptionResultSchema.parse(result);

    return Response.json(body, {
      status: 200,
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    if (error instanceof VolcSttError) {
      return errorResponse(PROVIDER_ERROR_CODES[error.code], requestId);
    }
    return errorResponse("STT_UNAVAILABLE", requestId);
  } finally {
    releaseRequest();
  }
}
