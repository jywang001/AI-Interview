import { randomUUID } from "node:crypto";
import { z } from "zod";
import { LiveInterviewSessionSchema } from "@/lib/interview/live-schemas";
import {
  LiveInterviewError,
  respondToLiveInterview,
} from "@/lib/interview/live-respond.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 45;

const RequestSchema = z
  .object({
    session: LiveInterviewSessionSchema,
    answerSource: z.enum(["voice", "text"]),
    rawSttText: z.string().min(1).max(8_000).nullable(),
    confirmedAnswerText: z.string().trim().min(2).max(8_000),
    requestId: z.string().min(1).max(160).regex(/^[A-Za-z0-9._:-]+$/u),
  })
  .strict()
  .superRefine((input, ctx) => {
    if ((input.answerSource === "voice") !== (input.rawSttText !== null)) {
      ctx.addIssue({
        code: "custom",
        message: "Answer source and raw STT text are inconsistent.",
        path: ["rawSttText"],
      });
    }
  });

const ERRORS = {
  MODEL_NOT_CONFIGURED: [503, "面试官模型尚未配置。"],
  MODEL_UNAVAILABLE: [502, "面试官暂时不可用，回答文字已保留，请重试。"],
  MODEL_OUTPUT_INVALID: [502, "面试官返回结果不完整，请重试本轮。"],
  INVALID_SESSION: [409, "面试会话状态不一致，请刷新后重试。"],
} as const;

function errorResponse(
  code: keyof typeof ERRORS | "INVALID_INPUT",
  requestId: string,
) {
  const [status, message] =
    code === "INVALID_INPUT"
      ? ([400, "请提交有效的面试会话和确认版回答。"] as const)
      : ERRORS[code];
  return Response.json(
    { ok: false, code, message, recoverable: true, requestId },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const fallbackRequestId = randomUUID();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_INPUT", fallbackRequestId);
  }
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) return errorResponse("INVALID_INPUT", fallbackRequestId);

  try {
    const result = await respondToLiveInterview(parsed.data);
    return Response.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof LiveInterviewError) {
      return errorResponse(error.code, parsed.data.requestId);
    }
    return errorResponse("MODEL_UNAVAILABLE", parsed.data.requestId);
  }
}
