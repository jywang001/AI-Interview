import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  InterviewDecisionSchema,
  InterviewSessionSchema,
  InterviewTurnSchema,
} from "@/lib/interview/schemas";
import {
  InterviewRespondError,
  respondToInterview,
  type InterviewRespondErrorCode,
} from "@/lib/interview/respond.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 45;

const MAX_REQUEST_BYTES = 512 * 1024;
const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
} as const;

const SafeIdSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u);

const InterviewRespondRequestSchema = z
  .object({
    session: InterviewSessionSchema,
    currentQuestionText: z.string().trim().min(1).max(500),
    answerSource: z.enum(["voice", "text"]),
    rawSttText: z.string().min(1).max(6_000).nullable(),
    confirmedAnswerText: z
      .string()
      .min(1)
      .max(6_000)
      .refine((text) => text.trim().length > 0),
    revisionId: SafeIdSchema,
    requestId: SafeIdSchema,
  })
  .strict()
  .superRefine((input, ctx) => {
    if (input.answerSource === "voice" && input.rawSttText === null) {
      ctx.addIssue({
        code: "custom",
        message: "Voice answers require raw STT text.",
        path: ["rawSttText"],
      });
    }
    if (input.answerSource === "text" && input.rawSttText !== null) {
      ctx.addIssue({
        code: "custom",
        message: "Text answers cannot include raw STT text.",
        path: ["rawSttText"],
      });
    }
  });

const InterviewRespondSuccessSchema = z
  .object({
    ok: z.literal(true),
    requestId: SafeIdSchema,
    turn: InterviewTurnSchema,
    decision: InterviewDecisionSchema,
    decisionReason: z.string().min(1),
    nextQuestionText: z.string().min(1).nullable(),
    objectiveId: z.string().min(1),
    isDynamicFollowUp: z.boolean(),
    interviewFinished: z.boolean(),
    model: z.string().min(1),
  })
  .strict();

const RouteErrorCodeSchema = z.enum([
  "INVALID_INPUT",
  "REQUEST_TOO_LARGE",
  "INVALID_SESSION",
  "TURN_BUDGET_EXHAUSTED",
  "REQUEST_ID_CONFLICT",
  "MODEL_NOT_CONFIGURED",
  "MODEL_TIMEOUT",
  "MODEL_UNAVAILABLE",
  "MODEL_OUTPUT_INVALID",
  "SAFETY_REJECTED",
]);

type RouteErrorCode = z.infer<typeof RouteErrorCodeSchema>;

const InterviewRespondErrorSchema = z
  .object({
    ok: z.literal(false),
    code: RouteErrorCodeSchema,
    message: z.string().min(1),
    recoverable: z.boolean(),
    requestId: z.string().min(1),
  })
  .strict();

const ERROR_DETAILS: Record<
  RouteErrorCode,
  { message: string; recoverable: boolean; status: number }
> = {
  INVALID_INPUT: {
    message: "请提交有效的面试会话和已确认回答。",
    recoverable: true,
    status: 400,
  },
  REQUEST_TOO_LARGE: {
    message: "本轮请求过大，请缩短回答后重试。",
    recoverable: true,
    status: 413,
  },
  INVALID_SESSION: {
    message: "面试会话状态或轮次记录不一致，请刷新后重试。",
    recoverable: true,
    status: 409,
  },
  TURN_BUDGET_EXHAUSTED: {
    message: "本场五轮面试已经结束，请进入复盘。",
    recoverable: false,
    status: 409,
  },
  REQUEST_ID_CONFLICT: {
    message: "请求标识已用于另一份回答，请重新提交。",
    recoverable: true,
    status: 409,
  },
  MODEL_NOT_CONFIGURED: {
    message: "面试官模型尚未配置，请联系管理员。",
    recoverable: true,
    status: 503,
  },
  MODEL_TIMEOUT: {
    message: "面试官思考超时，已确认回答仍然保留，请重试。",
    recoverable: true,
    status: 504,
  },
  MODEL_UNAVAILABLE: {
    message: "面试官服务暂时不可用，已确认回答仍然保留，请稍后重试。",
    recoverable: true,
    status: 502,
  },
  MODEL_OUTPUT_INVALID: {
    message: "面试官未能生成合法的下一步，请重新提交本轮。",
    recoverable: true,
    status: 502,
  },
  SAFETY_REJECTED: {
    message: "本轮内容触发了安全边界，请只提交模拟面试相关回答。",
    recoverable: true,
    status: 422,
  },
};

function errorResponse(code: RouteErrorCode, requestId: string) {
  const details = ERROR_DETAILS[code];
  const body = InterviewRespondErrorSchema.parse({
    ok: false,
    code,
    message: details.message,
    recoverable: details.recoverable,
    requestId,
  });

  return Response.json(body, {
    status: details.status,
    headers: NO_STORE_HEADERS,
  });
}

export async function POST(request: Request) {
  let responseRequestId: string = randomUUID();
  const contentType = request.headers.get("content-type")?.toLowerCase();
  if (!contentType || !/^application\/json(?:;|$)/u.test(contentType)) {
    return errorResponse("INVALID_INPUT", responseRequestId);
  }

  const rawContentLength = request.headers.get("content-length");
  if (rawContentLength) {
    const contentLength = Number(rawContentLength);
    if (!Number.isSafeInteger(contentLength) || contentLength < 0) {
      return errorResponse("INVALID_INPUT", responseRequestId);
    }
    if (contentLength > MAX_REQUEST_BYTES) {
      return errorResponse("REQUEST_TOO_LARGE", responseRequestId);
    }
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return errorResponse("INVALID_INPUT", responseRequestId);
  }
  if (Buffer.byteLength(rawBody, "utf8") > MAX_REQUEST_BYTES) {
    return errorResponse("REQUEST_TOO_LARGE", responseRequestId);
  }

  let unknownBody: unknown;
  try {
    unknownBody = JSON.parse(rawBody) as unknown;
  } catch {
    return errorResponse("INVALID_INPUT", responseRequestId);
  }

  const parsedRequest = InterviewRespondRequestSchema.safeParse(unknownBody);
  if (!parsedRequest.success) {
    return errorResponse("INVALID_INPUT", responseRequestId);
  }
  responseRequestId = parsedRequest.data.requestId;

  try {
    const result = await respondToInterview(parsedRequest.data);
    const body = InterviewRespondSuccessSchema.parse({
      ok: true,
      ...result,
    });
    return Response.json(body, {
      status: 200,
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    if (error instanceof InterviewRespondError) {
      return errorResponse(
        error.code satisfies InterviewRespondErrorCode,
        responseRequestId,
      );
    }

    console.error("Unexpected interviewer route failure", {
      errorType:
        error !== null && typeof error === "object" && "name" in error
          ? String(error.name).slice(0, 80)
          : null,
    });
    return errorResponse("MODEL_UNAVAILABLE", responseRequestId);
  }
}
