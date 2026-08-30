import { spawn } from "node:child_process";
import { Buffer } from "node:buffer";
import {
  MAX_RESUME_BYTES,
  MAX_RESUME_TEXT_CHARS,
} from "@/lib/materials/schemas";

const PDFTOTEXT_COMMAND = "pdftotext";
const PDFTOTEXT_MODES = ["raw", "layout"] as const;
const PDF_EXTRACTION_TIMEOUT_MS = 12_000;
const MAX_STDOUT_BYTES = MAX_RESUME_TEXT_CHARS * 4;

export type PdfTextErrorCode =
  | "PDF_EXTRACTION_UNAVAILABLE"
  | "PDF_EXTRACTION_FAILED"
  | "PDF_TEXT_EMPTY";

export class PdfTextError extends Error {
  readonly code: PdfTextErrorCode;

  constructor(code: PdfTextErrorCode) {
    super(code);
    this.name = "PdfTextError";
    this.code = code;
  }
}

function hasPdfHeader(pdf: Buffer) {
  return pdf.subarray(0, Math.min(pdf.length, 1_024)).includes("%PDF-");
}

function cleanExtractedText(value: string) {
  return value
    .replace(/\r\n?/gu, "\n")
    .replace(/\u0000/gu, "")
    .split("\n")
    .map((line) => line.replace(/[\t ]+/gu, " ").trim())
    .join("\n")
    .replace(/\n{4,}/gu, "\n\n\n")
    .trim();
}

function extractWithMode(pdf: Buffer, mode: (typeof PDFTOTEXT_MODES)[number]) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(
      PDFTOTEXT_COMMAND,
      [`-${mode}`, "-enc", "UTF-8", "-", "-"],
      {
        shell: false,
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      },
    );

    const stdoutChunks: Buffer[] = [];
    let stdoutBytes = 0;
    let settled = false;

    const finish = (result: { text: string } | { error: PdfTextError }) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);

      if ("error" in result) {
        if (child.exitCode === null && child.signalCode === null) {
          child.kill("SIGKILL");
        }
        reject(result.error);
        return;
      }

      resolve(result.text);
    };

    const timeout = setTimeout(() => {
      finish({ error: new PdfTextError("PDF_EXTRACTION_FAILED") });
    }, PDF_EXTRACTION_TIMEOUT_MS);
    timeout.unref();

    child.once("error", (error: NodeJS.ErrnoException) => {
      finish({
        error: new PdfTextError(
          error.code === "ENOENT"
            ? "PDF_EXTRACTION_UNAVAILABLE"
            : "PDF_EXTRACTION_FAILED",
        ),
      });
    });

    child.stdout.on("data", (chunk: Buffer) => {
      if (settled) {
        return;
      }

      stdoutBytes += chunk.byteLength;
      if (stdoutBytes > MAX_STDOUT_BYTES) {
        finish({ error: new PdfTextError("PDF_EXTRACTION_FAILED") });
        return;
      }

      stdoutChunks.push(chunk);
    });

    // Drain diagnostics without retaining PDF contents or tool output in memory.
    child.stderr.on("data", () => undefined);
    child.stdin.on("error", () => undefined);

    child.once("close", (exitCode) => {
      if (settled) {
        return;
      }

      if (exitCode !== 0) {
        finish({ error: new PdfTextError("PDF_EXTRACTION_FAILED") });
        return;
      }

      const text = cleanExtractedText(
        Buffer.concat(stdoutChunks, stdoutBytes).toString("utf8"),
      );

      if (text.length === 0) {
        finish({ error: new PdfTextError("PDF_TEXT_EMPTY") });
        return;
      }

      if (text.length > MAX_RESUME_TEXT_CHARS) {
        finish({ error: new PdfTextError("PDF_EXTRACTION_FAILED") });
        return;
      }

      finish({ text });
    });

    child.stdin.end(pdf);
  });
}

function meaningfulCharacterCount(value: string) {
  return value.match(/[\p{L}\p{N}]/gu)?.length ?? 0;
}

/**
 * `-layout` is useful for tables but often inserts thousands of positioning
 * spaces or changes the reading order of two-column resumes. `-raw` usually
 * preserves glyph order. Prefer the denser candidate while still requiring
 * enough actual text to reject image-only PDFs.
 */
export function selectBestExtractedText(candidates: readonly string[]) {
  const viable = candidates
    .map((original) => {
      const text = cleanExtractedText(original);
      const meaningfulCharacters = meaningfulCharacterCount(original);
      return {
        text,
        meaningfulCharacters,
        density: meaningfulCharacters / Math.max(1, original.length),
      };
    })
    .filter(
      (candidate) =>
        candidate.text.length > 0 &&
        candidate.text.length <= MAX_RESUME_TEXT_CHARS,
    )
    .filter((candidate) => candidate.meaningfulCharacters >= 6)
    .sort(
      (left, right) =>
        right.density - left.density ||
        right.meaningfulCharacters - left.meaningfulCharacters,
    );

  return viable[0]?.text ?? null;
}

export async function extractPdfText(pdfBytes: Uint8Array): Promise<string> {
  if (
    pdfBytes.byteLength === 0 ||
    pdfBytes.byteLength > MAX_RESUME_BYTES
  ) {
    throw new PdfTextError("PDF_EXTRACTION_FAILED");
  }

  const pdf = Buffer.from(
    pdfBytes.buffer,
    pdfBytes.byteOffset,
    pdfBytes.byteLength,
  );

  if (!hasPdfHeader(pdf)) {
    throw new PdfTextError("PDF_EXTRACTION_FAILED");
  }

  const results = await Promise.allSettled(
    PDFTOTEXT_MODES.map((mode) => extractWithMode(pdf, mode)),
  );
  const text = selectBestExtractedText(
    results.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : [],
    ),
  );

  if (text) return text;

  const unavailable = results.some(
    (result) =>
      result.status === "rejected" &&
      result.reason instanceof PdfTextError &&
      result.reason.code === "PDF_EXTRACTION_UNAVAILABLE",
  );
  throw new PdfTextError(
    unavailable ? "PDF_EXTRACTION_UNAVAILABLE" : "PDF_TEXT_EMPTY",
  );
}
