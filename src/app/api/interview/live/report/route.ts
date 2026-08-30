import { randomUUID } from "node:crypto";
import { z } from "zod";
import { LiveInterviewSessionSchema } from "@/lib/interview/live-schemas";
import {
  generateLiveCoachReport,
  LiveReportError,
} from "@/lib/interview/live-report.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RequestSchema = z
  .object({
    session: LiveInterviewSessionSchema,
    requestId: z.string().min(1).max(160).regex(/^[A-Za-z0-9._:-]+$/u),
  })
  .strict();

const ERRORS = {
  MODEL_NOT_CONFIGURED: [503, "复盘模型尚未配置。"],
  MODEL_UNAVAILABLE: [502, "复盘生成暂时失败，面试记录已保存，请重试。"],
  MODEL_OUTPUT_INVALID: [502, "复盘结果证据不完整，请重试生成。"],
  INVALID_SESSION: [409, "面试尚未完整结束，暂时不能生成复盘。"],
} as const;

function errorResponse(
  code: keyof typeof ERRORS | "INVALID_INPUT",
  requestId: string,
) {
  const [status, message] =
    code === "INVALID_INPUT"
      ? ([400, "请提交有效的已完成面试会话。"] as const)
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
    const report = await generateLiveCoachReport(parsed.data.session);
    return Response.json(
      { ok: true, requestId: parsed.data.requestId, report },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof LiveReportError) {
      return errorResponse(error.code, parsed.data.requestId);
    }
    return errorResponse("MODEL_UNAVAILABLE", parsed.data.requestId);
  }
}
