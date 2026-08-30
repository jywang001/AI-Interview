import { describe, expect, it } from "vitest";
import {
  alignExcerptToSource,
  groundMaterialOutput,
} from "@/lib/materials/evidence-grounding";
import { MaterialModelOutputSchema } from "@/lib/materials/schemas";

const resumeText = [
  "项目：智能知识助手",
  "负责 RAG 检索、重排与离线评估。",
  "将 P95 延迟从 4.8 秒降低到 2.6 秒。",
].join("\n");

const jdText = "AI 应用开发工程师：负责大模型应用、RAG 评估与线上服务稳定性。";

describe("material evidence grounding", () => {
  it("returns the exact source substring for an exact quote", () => {
    expect(alignExcerptToSource(resumeText, "负责 RAG 检索、重排与离线评估。"))
      .toBe("负责 RAG 检索、重排与离线评估。");
  });

  it("tolerates PDF whitespace and punctuation drift but returns source text", () => {
    expect(
      alignExcerptToSource(
        resumeText,
        "将P95延迟从4.8秒降低到2.6秒",
      ),
    ).toBe("将 P95 延迟从 4.8 秒降低到 2.6 秒");
  });

  it("rejects a model-authored claim that is absent from the source", () => {
    expect(alignExcerptToSource(resumeText, "吞吐量提升了十倍")).toBeNull();
  });

  it("drops hallucinated projects and keeps grounded projects", () => {
    const output = MaterialModelOutputSchema.parse({
      displayName: "测试候选人",
      headline: "AI 应用开发",
      education: [],
      experienceHighlights: ["负责知识助手"],
      projects: [
        {
          name: "智能知识助手",
          context: "RAG 项目",
          responsibilities: ["负责检索链路"],
          technologies: ["RAG"],
          confirmedClaims: ["负责 RAG 检索、重排与离线评估。"],
          evidence: [
            {
              sourceType: "resume",
              excerpt: "负责 RAG 检索、重排与离线评估。",
              location: "项目经历",
            },
          ],
        },
        {
          name: "不存在的项目",
          context: "模型臆测",
          responsibilities: ["负责虚构链路"],
          technologies: ["Unknown"],
          confirmedClaims: ["吞吐量提升了十倍"],
          evidence: [
            {
              sourceType: "resume",
              excerpt: "吞吐量提升了十倍",
              location: "项目经历",
            },
          ],
        },
      ],
      skills: ["RAG"],
      job: {
        title: "AI 应用开发工程师",
        companyLabel: null,
        responsibilities: ["负责大模型应用"],
        requiredSkills: ["RAG 评估"],
        preferredSkills: [],
        constraints: [],
        evidence: [
          {
            sourceType: "jd",
            excerpt: "负责大模型应用、RAG 评估与线上服务稳定性",
            location: "岗位描述",
          },
        ],
      },
      matchHighlights: ["具备 RAG 经验"],
      verificationRisks: [],
      excludedUnconfirmedItems: [],
    });

    const grounded = groundMaterialOutput(output, resumeText, jdText);

    expect(grounded?.projects).toHaveLength(1);
    expect(grounded?.projects[0].name).toBe("智能知识助手");
    expect(grounded?.excludedUnconfirmedItems.join(" ")).toContain(
      "缺少原文证据",
    );
  });
});
