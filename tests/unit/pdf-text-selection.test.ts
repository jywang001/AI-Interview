import { describe, expect, it } from "vitest";
import { selectBestExtractedText } from "@/lib/materials/pdf-text.server";

describe("PDF text candidate selection", () => {
  it("prefers glyph-order text over layout output padded with positioning spaces", () => {
    const layout = [
      "项目经历                         技能",
      "智能知识助手                     TypeScript",
      "负责检索与评估                   RAG",
    ].join("\n");
    const raw = [
      "项目经历",
      "智能知识助手",
      "负责检索与评估",
      "技能",
      "TypeScript",
      "RAG",
    ].join("\n");

    expect(selectBestExtractedText([layout, raw])).toBe(raw);
  });

  it("rejects candidates without meaningful text", () => {
    expect(selectBestExtractedText(["   \n\n---", "\t"])).toBeNull();
  });
});
