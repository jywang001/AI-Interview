import {
  LIVE_STAGE_IDS,
  LiveInterviewSessionSchema,
  type InterviewMode,
  type LiveInterviewSession,
  type LiveStage,
  type LiveStageId,
} from "@/lib/interview/live-schemas";
import { selectHot100Problem } from "@/lib/interview/hot100";
import { primaryResumeQuestion } from "@/lib/interview/resume-focus";
import type {
  CandidateBrief,
  RoleProfile,
} from "@/lib/interview/schemas";
import { RoleProfileSchema } from "@/lib/interview/schemas";

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

export function buildRoleProfile(
  roleId: "ai_algorithm" | "ai_application",
): RoleProfile {
  const sharedCompetencies = [
    {
      id: "question_response",
      label: "回应问题",
      description: "直接回答问题，并用结构化信息支持结论。",
      weight: 15,
    },
    {
      id: "ownership",
      label: "项目所有权",
      description: "区分个人决策、实施和团队贡献。",
      weight: 20,
    },
    {
      id: "technical_reasoning",
      label: "技术推理",
      description: "说明方案、替代路径、边界与取舍。",
      weight: 25,
    },
    {
      id: "result_evidence",
      label: "结果证据",
      description: "用可信评估、指标和限制支撑结果。",
      weight: 20,
    },
    {
      id: "job_relevance",
      label: "岗位相关性",
      description: "把经验映射到目标岗位职责。",
      weight: 20,
    },
  ];

  return RoleProfileSchema.parse(
    roleId === "ai_algorithm"
      ? {
          id: roleId,
          label: "AI 算法岗",
          summary: "关注数据、建模、实验设计、指标、bad case 与泛化边界。",
          competencyWeights: sharedCompetencies,
          requiredSignals: [
            "能够准确解释核心算法或模型概念",
            "能够设计可靠的数据划分、baseline 与对照实验",
            "能够解释指标选择并分析 bad case",
            "能够识别模型的适用边界与泛化风险",
          ],
          scenarioConstraints: ["数据分布变化且标注预算有限"],
        }
      : {
          id: roleId,
          label: "AI 应用开发岗",
          summary: "关注模型能力能否通过清晰架构、可验证评估与可靠降级形成可交付产品。",
          competencyWeights: sharedCompetencies,
          requiredSignals: [
            "能够解释端到端请求链路",
            "能够设计离线评估与线上监控",
            "能够在延迟、成本和质量之间做可验证取舍",
            "能够说明超时、模型不可用和流量突增时的降级方案",
          ],
          scenarioConstraints: ["流量扩大十倍，同时推理预算减少一半"],
        },
  );
}

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
  const resumeSlots =
    roleId === "ai_algorithm"
      ? [
          slot("personal_ownership", "个人贡献", "区分个人工作与团队工作。", "must"),
          slot(
            "algorithm_data_depth",
            "算法与数据深度",
            "说明亲自负责的方法、数据处理或训练实验细节。",
            "must",
          ),
          slot(
            "experimental_reasoning",
            "实验判断",
            "解释方法选择、baseline、实验设计或关键取舍。",
            "should",
          ),
          slot(
            "claimed_result_validation",
            "结果核验",
            "仅在候选人声称效果提升时核验指标、对照或评估方法。",
            "should",
          ),
          slot(
            "failure_generalization",
            "失败与泛化",
            "说明 bad case、适用边界或泛化风险。",
            "optional",
          ),
        ]
      : [
          slot("personal_ownership", "个人贡献", "区分个人工作与团队工作。", "must"),
          slot(
            "system_depth",
            "系统与实现深度",
            "说明亲自负责的模块、数据流、状态或关键实现。",
            "must",
          ),
          slot(
            "engineering_reasoning",
            "工程判断",
            "解释方案选择以及效果、成本、延迟或可靠性取舍。",
            "should",
          ),
          slot(
            "claimed_result_validation",
            "结果核验",
            "仅在候选人声称优化或提升时核验测试、指标或对照。",
            "should",
          ),
          slot(
            "failure_boundary",
            "失败与边界",
            "说明故障、降级、局限或后续改进。",
            "optional",
          ),
        ];
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
      purpose: "选择与 JD 最相关或最值得核验的经历，判断个人贡献与岗位技术深度。",
      slots: resumeSlots,
      maxFollowUps: realistic ? 4 : 2,
      timeBudgetSeconds: realistic ? 720 : 360,
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
      title: "Hot 100 算法讲解",
      purpose: "独立思考后向面试官讲清解决方案与具体实现，不要求现场编码。",
      slots: [
        slot("solution_core", "解题思路", "给出逻辑正确的核心解法。", "must"),
        slot(
          "implementation_walkthrough",
          "实现讲解",
          "说明所用数据结构、关键状态以及实现步骤。",
          "must",
        ),
        slot(
          "logic_completeness",
          "逻辑完整性",
          "关键分支、更新顺序或终止条件不存在明显缺口。",
          "should",
        ),
      ],
      maxFollowUps: realistic ? 4 : 2,
      timeBudgetSeconds: realistic ? 600 : 420,
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
  session: Pick<
    LiveInterviewSession,
    "candidateBrief" | "roleId" | "algorithmProblem"
  >,
) {
  const brief = session.candidateBrief;
  const roleLabel = session.roleId === "ai_algorithm" ? "AI 算法岗" : "AI 应用开发岗";

  const questions: Record<LiveStageId, string> = {
    self_intro: `欢迎参加本次 ${roleLabel} 模拟面试。请先用 90 秒做一个自我介绍，重点讲与目标岗位最相关的经历。`,
    resume_deep_dive: primaryResumeQuestion(brief),
    role_knowledge:
      session.roleId === "ai_algorithm"
        ? "如果要证明一个新模型方案确实优于更简单的 baseline，你会怎样设计数据划分、指标和对照实验？"
        : "请完整解释一个 LLM 应用请求从进入服务到返回答案的链路，并说明你会在哪里做评估、监控和降级。",
    algorithm_reasoning: `算法题是「${session.algorithmProblem.title}」（${session.algorithmProblem.sourceLabel}）：${session.algorithmProblem.prompt} 你可以先独立思考，准备好后向我讲解思路和具体实现。`,
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
  const algorithmProblem = selectHot100Problem({
    sessionId: input.id,
    mode: input.mode,
    roleId: input.roleProfile.id,
  });
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
    algorithmProblem,
    algorithmThinkingEndsAt: null,
    algorithmThinkingCompletedAt: null,
    turns: [],
    startedAt,
    completedAt: null,
  };

  return LiveInterviewSessionSchema.parse({
    ...base,
    currentQuestionText: openingQuestionForStage(LIVE_STAGE_IDS[0], base),
  });
}
