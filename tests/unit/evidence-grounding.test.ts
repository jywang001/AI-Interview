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

  it("recovers a project from a grounded project name when quotes were paraphrased", () => {
    const recovered = groundMaterialOutput(
      MaterialModelOutputSchema.parse({
        displayName: "候选人",
        headline: "AI 应用开发",
        education: [],
        experienceHighlights: ["知识助手项目"],
        projects: [
          {
            name: "智能知识助手",
            context: "RAG 项目",
            responsibilities: ["模型改写后的检索职责"],
            technologies: ["RAG"],
            confirmedClaims: ["不存在于简历中的改写主张"],
            evidence: [
              {
                sourceType: "resume",
                excerpt: "不存在于简历中的改写引用",
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
              excerpt: "不存在于 JD 的改写引用",
              location: "岗位描述",
            },
          ],
        },
        matchHighlights: ["具备相关经验"],
        verificationRisks: [],
        excludedUnconfirmedItems: [],
      }),
      resumeText,
      jdText,
    );

    expect(recovered?.projects).toHaveLength(1);
    expect(recovered?.projects[0].evidence[0].excerpt).toBe("智能知识助手");
    expect(recovered?.projects[0].confirmedClaims).toContain("智能知识助手");
    expect(recovered?.excludedUnconfirmedItems.join(" ")).toContain(
      "恢复原文证据",
    );
  });

  it("returns a grounded partial draft instead of failing the whole document", () => {
    const recovered = groundMaterialOutput(
      MaterialModelOutputSchema.parse({
        displayName: "候选人",
        headline: "后端开发",
        education: [],
        experienceHighlights: ["相关经历"],
        projects: [
          {
            name: "模型虚构名称",
            context: "模型虚构上下文",
            responsibilities: ["模型虚构职责"],
            technologies: ["Unknown"],
            confirmedClaims: ["模型虚构主张"],
            evidence: [
              {
                sourceType: "resume",
                excerpt: "模型虚构引用",
                location: "项目经历",
              },
            ],
          },
        ],
        skills: ["后端开发"],
        job: {
          title: "模型虚构岗位",
          companyLabel: null,
          responsibilities: ["模型虚构职责"],
          requiredSkills: ["模型虚构技能"],
          preferredSkills: [],
          constraints: [],
          evidence: [
            {
              sourceType: "jd",
              excerpt: "模型虚构 JD 引用",
              location: "岗位描述",
            },
          ],
        },
        matchHighlights: ["待确认"],
        verificationRisks: [],
        excludedUnconfirmedItems: [],
      }),
      "项目经历\n负责真实项目的后端开发与服务部署。",
      "岗位职责：负责后端开发与系统稳定性。",
    );

    expect(recovered).not.toBeNull();
    expect(recovered?.projects[0].name).toBe("简历相关经历");
    expect(recovered?.projects[0].confirmedClaims[0]).toContain("负责真实项目");
    expect(recovered?.job.evidence[0].excerpt).toContain("岗位职责");
    expect(recovered?.excludedUnconfirmedItems.join(" ")).toContain(
      "待确认",
    );
  });
});
