import { describe, expect, it } from "vitest";
import { demoCandidateBrief } from "@/fixtures/demo-session";
import { CandidateBriefSchema } from "@/lib/interview/schemas";
import {
  primaryResumeQuestion,
  rankResumeFocuses,
} from "@/lib/interview/resume-focus";
import { selectRoleKnowledgeTopics } from "@/lib/interview/role-knowledge";

function candidateFor(roleId: "ai_algorithm" | "ai_application") {
  const baseEvidence = demoCandidateBrief.projects[0].evidenceRefs;
  return CandidateBriefSchema.parse({
    ...demoCandidateBrief,
    id: `candidate-${roleId}`,
    roleId,
    projects: [
      {
        ...demoCandidateBrief.projects[0],
        id: "research-project",
        name: "实验室推荐模型研究",
        context: "科研课题与论文实验",
        responsibilities: ["负责训练数据处理、baseline 与消融实验"],
        technologies: ["PyTorch", "Transformer"],
        confirmedClaims: ["完成推荐模型训练与 bad case 分析"],
        evidenceRefs: baseEvidence,
      },
      {
        ...demoCandidateBrief.projects[0],
        id: "internship-project",
        name: "大模型应用实习",
        context: "公司线上业务实习交付",
        responsibilities: ["负责 RAG API、缓存、监控和降级"],
        technologies: ["RAG", "TypeScript", "Docker"],
        confirmedClaims: ["完成线上服务部署与故障降级"],
        evidenceRefs: baseEvidence,
      },
    ],
    skills:
      roleId === "ai_algorithm"
        ? ["PyTorch", "Transformer", "数据集"]
        : ["RAG", "TypeScript", "Docker"],
    job: {
      ...demoCandidateBrief.job,
      title: roleId === "ai_algorithm" ? "AI 算法工程师" : "AI 应用开发工程师",
      responsibilities:
        roleId === "ai_algorithm"
          ? ["负责模型训练、实验设计和 bad case 分析"]
          : ["负责 RAG API、线上部署和服务稳定性"],
      requiredSkills:
        roleId === "ai_algorithm"
          ? ["PyTorch", "Transformer", "baseline"]
          : ["RAG", "TypeScript", "Docker"],
    },
  });
}

describe("role-specific resume routing", () => {
  it("prioritizes research and experiment evidence for algorithm roles", () => {
    const brief = candidateFor("ai_algorithm");
    const [focus] = rankResumeFocuses(brief);

    expect(focus.kind).toBe("research");
    expect(focus.project.name).toBe("实验室推荐模型研究");
    expect(primaryResumeQuestion(brief)).toContain("科研经历");
  });

  it("prioritizes relevant internships and delivery chains for application roles", () => {
    const brief = candidateFor("ai_application");
    const [focus] = rankResumeFocuses(brief);

    expect(focus.kind).toBe("internship");
    expect(focus.project.name).toBe("大模型应用实习");
    expect(primaryResumeQuestion(brief)).toContain("实习经历");
  });

  it("selects concrete knowledge topics from JD and skill signals", () => {
    const brief = CandidateBriefSchema.parse({
      ...candidateFor("ai_application"),
      skills: ["RAG", "向量检索", "知识库"],
      job: {
        ...candidateFor("ai_application").job,
        responsibilities: ["建设 RAG 知识库问答与向量检索链路"],
        requiredSkills: ["RAG", "检索", "向量"],
        preferredSkills: [],
      },
    });
    const topics = selectRoleKnowledgeTopics(brief, 3);

    expect(topics).toHaveLength(3);
    expect(topics[0].id).toBe("rag_error_attribution");
    expect(topics.every((topic) => topic.question.length > 10)).toBe(true);
  });
});
