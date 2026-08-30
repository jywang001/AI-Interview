import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { RoleIdSchema, type RoleId } from "@/lib/interview/schemas";
import {
  analyzeMaterials,
  MaterialAnalysisError,
} from "@/lib/materials/analyze.server";
import {
  MAX_JD_CHARS,
  MAX_RESUME_BYTES,
  MIN_JD_CHARS,
  MaterialParseErrorSchema,
  MaterialParseSuccessSchema,
  type MaterialParseError,
} from "@/lib/materials/schemas";
import {
  extractPdfText,
  PdfTextError,
} from "@/lib/materials/pdf-text.server";
import { reserveMaterialAnalysisRequest } from "@/lib/materials/request-guard.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 150;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
} as const;
const MAX_MATERIAL_REQUEST_BYTES = MAX_RESUME_BYTES + 1024 * 1024;

const ERROR_DETAILS: Record<
  MaterialParseError["code"],
  { message: string; recoverable: boolean; status: number }
> = {
  INVALID_INPUT: {
    message: "请提交有效的岗位类型、JD 文本和不超过 8 MB 的 PDF 简历。",
    recoverable: true,
    status: 400,
  },
  REQUEST_TOO_LARGE: {
    message: "请求体过大，请提交不超过 8 MB 的 PDF 和 12,000 字以内的 JD。",
    recoverable: true,
    status: 413,
  },
  RATE_LIMITED: {
    message: "材料分析请求过于频繁，请一分钟后重试。",
    recoverable: true,
    status: 429,
  },
  PDF_EXTRACTION_UNAVAILABLE: {
    message: "PDF 文本提取服务暂不可用，请稍后重试。",
    recoverable: true,
    status: 503,
  },
  PDF_EXTRACTION_FAILED: {
    message: "无法读取这份 PDF，请确认文件有效且包含可提取文本。",
    recoverable: true,
    status: 422,
  },
  PDF_TEXT_EMPTY: {
    message: "这份 PDF 未提取到文字，请上传文本型 PDF。",
    recoverable: true,
    status: 422,
  },
  MODEL_NOT_CONFIGURED: {
    message: "材料分析服务尚未配置，请联系管理员。",
    recoverable: true,
    status: 503,
  },
  MODEL_UNAVAILABLE: {
    message: "材料分析服务暂时不可用，请稍后重试。",
    recoverable: true,
    status: 502,
  },
  MODEL_OUTPUT_INVALID: {
    message: "本次分析结果不完整，请重新提交材料。",
    recoverable: true,
    status: 502,
  },
  EVIDENCE_NOT_GROUNDED: {
    message: "本次分析没有提取到足够的简历或 JD 原文证据，请检查 PDF 文本与 JD 后重试。",
    recoverable: true,
    status: 422,
  },
};

function errorResponse(
  code: MaterialParseError["code"],
  requestId: string,
) {
  const details = ERROR_DETAILS[code];
  const body = MaterialParseErrorSchema.parse({
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
      ...(code === "RATE_LIMITED" ? { "Retry-After": "60" } : {}),
    },
  });
}

function safeResumeFileName(fileName: string) {
  const baseName = fileName.split(/[\\/]/u).at(-1) ?? "resume.pdf";
  const cleaned = baseName
    .replace(/[\u0000-\u001f\u007f]/gu, "")
    .trim()
    .slice(0, 240);
  return cleaned || "resume.pdf";
}

function isPdfUpload(file: File) {
  const type = file.type.toLowerCase();
  return (
    file.name.toLowerCase().endsWith(".pdf") &&
    (type === "" || type === "application/pdf" || type === "application/x-pdf")
  );
}

function validateTextFields(formData: FormData):
  | { roleId: RoleId; jdText: string }
  | null {
  const roleResult = RoleIdSchema.safeParse(formData.get("roleId"));
  const rawJdText = formData.get("jdText");

  if (!roleResult.success || typeof rawJdText !== "string") {
    return null;
  }

  const jdText = rawJdText.trim();
  if (jdText.length < MIN_JD_CHARS || jdText.length > MAX_JD_CHARS) {
    return null;
  }

  return { roleId: roleResult.data, jdText };
}

export async function POST(request: Request) {
  const requestId = randomUUID();
  const startedAt = Date.now();
  let stage = "request_validation";
  const contentType = request.headers.get("content-type")?.toLowerCase();

  if (!contentType || !/^multipart\/form-data(?:;|$)/u.test(contentType)) {
    return errorResponse("INVALID_INPUT", requestId);
  }

  const rawContentLength = request.headers.get("content-length");
  if (rawContentLength) {
    const contentLength = Number(rawContentLength);
    if (!Number.isSafeInteger(contentLength) || contentLength < 0) {
      return errorResponse("INVALID_INPUT", requestId);
    }
    if (contentLength > MAX_MATERIAL_REQUEST_BYTES) {
      return errorResponse("REQUEST_TOO_LARGE", requestId);
    }
  }

  const releaseRequest = reserveMaterialAnalysisRequest();
  if (!releaseRequest) {
    return errorResponse("RATE_LIMITED", requestId);
  }

  try {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return errorResponse("INVALID_INPUT", requestId);
    }

    const textFields = validateTextFields(formData);
    const resume = formData.get("resume");

    if (
      !textFields ||
      !(resume instanceof File) ||
      resume.size === 0 ||
      resume.size > MAX_RESUME_BYTES ||
      !isPdfUpload(resume)
    ) {
      return errorResponse("INVALID_INPUT", requestId);
    }

    let resumeBytes: Buffer;
    try {
      resumeBytes = Buffer.from(await resume.arrayBuffer());
    } catch {
      return errorResponse("INVALID_INPUT", requestId);
    }

    stage = "pdf_extraction";
    const resumeText = await extractPdfText(resumeBytes);
    stage = "model_analysis";
    const analysis = await analyzeMaterials({
      roleId: textFields.roleId,
      resumeText,
      jdText: textFields.jdText,
    });
    const createdAt = new Date().toISOString();
    stage = "response_validation";
    const body = MaterialParseSuccessSchema.parse({
      ok: true,
      draft: analysis.draft,
      meta: {
        requestId,
        resumeFileName: safeResumeFileName(resume.name),
        resumeCharacterCount: resumeText.length,
        jdCharacterCount: textFields.jdText.length,
        extractionMethod: "pdftotext",
        model: analysis.model,
        createdAt,
      },
    });

    return Response.json(body, {
      status: 200,
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    const code =
      error instanceof PdfTextError || error instanceof MaterialAnalysisError
        ? error.code
        : "MODEL_UNAVAILABLE";
    console.error("Material parse request failed", {
      requestId,
      stage,
      code,
      elapsedMs: Date.now() - startedAt,
    });
    if (error instanceof PdfTextError) {
      return errorResponse(error.code, requestId);
    }
    if (error instanceof MaterialAnalysisError) {
      return errorResponse(error.code, requestId);
    }
    return errorResponse("MODEL_UNAVAILABLE", requestId);
  } finally {
    releaseRequest();
  }
}
