import {
  LIVE_STAGE_IDS,
  LiveInterviewSessionSchema,
  type InterviewMode,
  type LiveInterviewSession,
  type LiveStage,
  type LiveStageId,
} from "@/lib/interview/live-schemas";
import type {
  CandidateBrief,
  RoleProfile,
} from "@/lib/interview/schemas";

export const INTERVIEW_MODE_COPY = {
  quick: {
    label: "快速体验",
    description: "时间较短，适合快速上手；关键证据充分后立即推进。",
    duration: "约 12–18 分钟",
  },
  realistic: {
    label: "真实模拟",
    description: "更接近真实面试，追问更深入，整体耗时较长。",
    duration: "约 30–45 分钟",
  },
} as const;

const slot = (
  id: string,
  label: string,
  description: string,
  priority: "must" | "should" | "optional",
) => ({ id, label, description, priority }) as const;

export function buildLiveStages(
  roleId: "ai_algorithm" | "ai_application",
  mode: InterviewMode,
): LiveStage[] {
  const realistic = mode === "realistic";
  const roleSlots =
    roleId === "ai_algorithm"
      ? [
          slot("concept_accuracy", "概念准确", "核心算法或模型概念准确。", "must"),
          slot("data_and_baseline", "数据与基线", "能说明数据、baseline 或对照方法。", "must"),
          slot("evaluation", "实验评估", "能解释指标、实验或错误分析。", "should"),
          slot("limitations", "边界与局限", "能识别方法适用边界。", "optional"),
        ]
      : [
          slot("system_understanding", "系统理解", "能解释 LLM/RAG/Agent 请求链路。", "must"),
          slot("engineering_tradeoff", "工程权衡", "能权衡效果、延迟、成本或复杂度。", "must"),
          slot("evaluation_reliability", "评估与可靠性", "能说明评估、监控或降级。", "should"),
          slot("security_boundary", "安全边界", "能识别输入、数据或模型风险。", "optional"),
        ];

  return [
    {
      id: "self_intro",
      order: 1,
      title: "自我介绍",
      purpose: "判断候选人能否在有限时间内清楚呈现背景与核心经历。",
      slots: [
        slot("current_background", "当前背景", "说明当前身份或核心经历。", "must"),
        slot("target_direction", "目标方向", "说明目标岗位方向。", "must"),
        slot("relevant_highlight", "相关亮点", "给出最相关的一项经历或能力。", "should"),
      ],
      maxFollowUps: realistic ? 2 : 1,
      timeBudgetSeconds: realistic ? 300 : 150,
    },
    {
      id: "resume_deep_dive",
      order: 2,
      title: "简历项目拷打",
      purpose: "验证简历主张、个人所有权、技术深度与结果证据。",
      slots: [
        slot("personal_ownership", "个人贡献", "区分个人决策、实现与团队工作。", "must"),
        slot("implementation", "实现细节", "说明关键模块、数据流或技术实现。", "must"),
        slot("decision_rationale", "方案理由", "解释为何这样设计及替代方案。", "should"),
        slot("result_evidence", "结果证据", "给出评估方法、指标或可核验结果。", "must"),
        slot("failure_limit", "失败与局限", "说明失败案例、边界或改进方向。", "should"),
      ],
      maxFollowUps: realistic ? 5 : 2,
      timeBudgetSeconds: realistic ? 900 : 360,
    },
    {
      id: "role_knowledge",
      order: 3,
      title: "岗位八股与理解",
      purpose: "检验岗位核心知识是否准确，并能否落到真实场景。",
      slots: roleSlots,
      maxFollowUps: realistic ? 4 : 2,
      timeBudgetSeconds: realistic ? 720 : 300,
    },
    {
      id: "algorithm_reasoning",
      order: 4,
      title: "算法思路问答",
      purpose: "用口述思路替代 P0 代码执行，观察问题分解与边界意识。",
      slots: [
        slot("problem_restated", "理解题意", "准确复述问题与约束。", "must"),
        slot("core_approach", "核心思路", "给出可执行的算法或数据结构方案。", "must"),
        slot("complexity", "复杂度", "说明时间与空间复杂度。", "must"),
        slot("edge_cases", "边界条件", "识别空输入、重复值或规模边界。", "should"),
      ],
      maxFollowUps: realistic ? 4 : 2,
      timeBudgetSeconds: realistic ? 720 : 300,
    },
    {
      id: "motivation_availability",
      order: 5,
      title: "岗位意愿与到岗安排",
      purpose: "判断岗位动机与经历映射，并记录真实到岗安排。",
      slots: [
        slot("role_motivation", "岗位动机", "说明选择该岗位的具体原因。", "must"),
        slot("experience_mapping", "经历映射", "把已有经历连接到岗位职责。", "should"),
        slot("expected_work", "工作期待", "说明希望承担的工作或成长方向。", "optional"),
        slot("earliest_start", "最早到岗", "给出最早可到岗时间。", "must"),
        slot("commitment", "持续投入", "说明持续时间与每周投入安排。", "must"),
      ],
      maxFollowUps: realistic ? 3 : 2,
      timeBudgetSeconds: realistic ? 420 : 210,
    },
    {
      id: "candidate_questions",
      order: 6,
      title: "候选人反问",
      purpose: "给候选人反问机会，并以自然结束语完成面试。",
      slots: [
        slot("question_or_none", "明确反问", "提出一个明确问题，或明确表示暂无问题。", "must"),
        slot("question_relevance", "问题相关性", "问题与岗位、团队或工作内容相关。", "optional"),
      ],
      maxFollowUps: realistic ? 2 : 1,
      timeBudgetSeconds: realistic ? 300 : 150,
    },
  ];
}

export function openingQuestionForStage(
  stageId: LiveStageId,
  session: Pick<LiveInterviewSession, "candidateBrief" | "roleId">,
) {
  const brief = session.candidateBrief;
  const project = brief.projects[0];
  const roleLabel = session.roleId === "ai_algorithm" ? "AI 算法岗" : "AI 应用开发岗";

  const questions: Record<LiveStageId, string> = {
    self_intro: `欢迎参加本次 ${roleLabel} 模拟面试。请先用 90 秒做一个自我介绍，重点讲与目标岗位最相关的经历。`,
    resume_deep_dive: project
      ? `我们具体聊聊你简历里的“${project.name}”。请说明你亲自负责了什么、核心方案如何实现，以及你如何验证结果。`
      : "请选择简历中最有代表性的项目，说明你的个人贡献、核心实现和结果证据。",
    role_knowledge:
      session.roleId === "ai_algorithm"
        ? "如果要证明一个新模型方案确实优于更简单的 baseline，你会怎样设计数据划分、指标和对照实验？"
        : "请完整解释一个 LLM 应用请求从进入服务到返回答案的链路，并说明你会在哪里做评估、监控和降级。",
    algorithm_reasoning:
      "给定一个包含重复元素的无序数组，请设计一个方法找出第 K 大元素。先澄清约束，再说明核心思路、复杂度和边界情况。",
    motivation_availability: `为什么选择“${brief.job.title}”这个岗位？请结合你的经历说明匹配点。`,
    candidate_questions:
      "我们的主要问题到这里。你有什么想进一步了解的岗位、团队或工作内容吗？",
  };

  return questions[stageId];
}

export function createLiveInterviewSession(input: {
  id: string;
  mode: InterviewMode;
  roleProfile: RoleProfile;
  candidateBrief: CandidateBrief;
}): LiveInterviewSession {
  const stages = buildLiveStages(input.roleProfile.id, input.mode);
  const startedAt = new Date().toISOString();
  const base = {
    id: input.id,
    state: "INTERVIEWING" as const,
    mode: input.mode,
    roleId: input.roleProfile.id,
    roleProfile: input.roleProfile,
    candidateBrief: input.candidateBrief,
    stages,
    currentStageIndex: 0,
    currentQuestionText: "",
    turns: [],
    startedAt,
    completedAt: null,
  };

  return LiveInterviewSessionSchema.parse({
    ...base,
    currentQuestionText: openingQuestionForStage(LIVE_STAGE_IDS[0], base),
  });
}
