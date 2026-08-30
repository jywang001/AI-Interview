import {
  DemoSessionFixtureSchema,
  type EvidenceReference,
} from "../lib/interview/schemas";

function sourceEvidence(
  id: string,
  sourceType: "resume" | "jd" | "role_profile",
  sourceId: string,
  excerpt: string,
  location: string,
): EvidenceReference {
  return {
    id,
    sourceType,
    sourceId,
    excerpt,
    location,
    confirmed: true,
    revisionId: null,
    startOffset: null,
    endOffset: null,
  };
}

function transcriptEvidence(
  id: string,
  turnId: string,
  revisionId: string,
  confirmedAnswerText: string,
  excerpt: string,
): EvidenceReference {
  const startOffset = confirmedAnswerText.indexOf(excerpt);
  if (startOffset < 0) {
    throw new Error(`Fixture evidence ${id} is not present in its transcript.`);
  }

  return {
    id,
    sourceType: "transcript",
    sourceId: turnId,
    excerpt,
    location: `回答 ${turnId}`,
    confirmed: true,
    revisionId,
    startOffset,
    endOffset: startOffset + excerpt.length,
  };
}

const resumeProjectRef = sourceEvidence(
  "ev-resume-project",
  "resume",
  "resume-demo-001",
  "独立负责智能知识助手的检索与生成服务，使用 200 条脱敏回放请求评估，将 P95 端到端延迟从 4.8 秒降至 2.6 秒。",
  "项目经历 / 智能知识助手",
);

const resumeOwnershipRef = sourceEvidence(
  "ev-resume-ownership",
  "resume",
  "resume-demo-001",
  "负责 API 设计、混合检索链路、离线评估脚本和服务降级策略。",
  "项目经历 / 个人职责",
);

const jdDeliveryRef = sourceEvidence(
  "ev-jd-delivery",
  "jd",
  "jd-demo-001",
  "能够把大模型能力集成进线上服务，并建立评估、监控和降级机制。",
  "岗位职责 / AI 应用交付",
);

const jdReliabilityRef = sourceEvidence(
  "ev-jd-reliability",
  "jd",
  "jd-demo-001",
  "关注请求链路的延迟、成本、可观测性与故障恢复。",
  "岗位要求 / 工程质量",
);

const roleScenarioRef = sourceEvidence(
  "ev-role-scenario",
  "role_profile",
  "ai_application",
  "在流量、预算或模型可用性变化时说明系统边界与取舍。",
  "AI 应用开发岗 / 场景约束",
);

const answer1 =
  "我想做 AI 应用开发，是因为我更喜欢把模型能力变成可评估、可降级的产品链路。最近的智能知识助手项目里，我负责从检索到生成的服务层，也补了离线评估和超时降级；这个岗位强调的正是模型集成和工程可靠性。";
const answer2 =
  "我负责服务 API 和检索生成链路。请求先经过关键词与向量混合召回，再做重排，最后只把带来源编号的片段交给模型；返回结果同时保留引用。为避免只看主观案例，我写了回放评估脚本，并用缓存和并行检索把 P95 延迟从 4.8 秒降到 2.6 秒。";
const answer3 =
  "我从脱敏历史问题里人工整理了 200 条，按问题类别分层后再切训练调试集和最终评估集，同一会话不跨集合。评估时先看答案中的关键结论能否被引用片段支持，再记录无答案、错引和检索遗漏三类失败。这个集合能比较版本，但还不能代表真实线上分布。";
const answer4 =
  "我会把检索、重排和生成分别设超时并记录阶段耗时。生成超时只重试一次，仍失败就返回检索片段的提取式摘要并明确提示降级；连续失败触发熔断。监控至少包含各阶段 P95、超时率、降级率和引用为空率，避免只有总接口错误码。";
const answer5 =
  "我会先加缓存和请求合并，再把简单问题路由到小模型，复杂问题保留原模型；高峰期限制低优先级请求，并减少重排候选数。这样应该能降低成本和延迟，但我还需要压测后才能确定阈值。";

const answer1Evidence = transcriptEvidence(
  "ev-turn-1-role-fit",
  "turn-1",
  "turn-1-r1",
  answer1,
  "把模型能力变成可评估、可降级的产品链路",
);
const answer2OwnershipEvidence = transcriptEvidence(
  "ev-turn-2-ownership",
  "turn-2",
  "turn-2-r1",
  answer2,
  "我负责服务 API 和检索生成链路",
);
const answer2LatencyEvidence = transcriptEvidence(
  "ev-turn-2-latency",
  "turn-2",
  "turn-2-r1",
  answer2,
  "把 P95 延迟从 4.8 秒降到 2.6 秒",
);
const answer3DatasetEvidence = transcriptEvidence(
  "ev-turn-3-dataset",
  "turn-3",
  "turn-3-r2",
  answer3,
  "人工整理了 200 条，按问题类别分层后再切训练调试集和最终评估集",
);
const answer3LimitEvidence = transcriptEvidence(
  "ev-turn-3-limit",
  "turn-3",
  "turn-3-r2",
  answer3,
  "还不能代表真实线上分布",
);
const answer4FallbackEvidence = transcriptEvidence(
  "ev-turn-4-fallback",
  "turn-4",
  "turn-4-r1",
  answer4,
  "仍失败就返回检索片段的提取式摘要并明确提示降级",
);
const answer4MetricsEvidence = transcriptEvidence(
  "ev-turn-4-metrics",
  "turn-4",
  "turn-4-r1",
  answer4,
  "各阶段 P95、超时率、降级率和引用为空率",
);
const answer5TradeoffEvidence = transcriptEvidence(
  "ev-turn-5-tradeoff",
  "turn-5",
  "turn-5-r1",
  answer5,
  "把简单问题路由到小模型，复杂问题保留原模型",
);
const answer5GapEvidence = transcriptEvidence(
  "ev-turn-5-gap",
  "turn-5",
  "turn-5-r1",
  answer5,
  "还需要压测后才能确定阈值",
);

const revisedDrillAnswer =
  "我会先用压测确认当前吞吐、各阶段 P95 和单请求成本，再按十倍流量建立容量表。第一步用语义缓存和请求合并吸收重复流量；第二步根据问题复杂度分层，小模型只处理有确定模板和高置信检索结果的请求；第三步为生成服务设置并发上限，超限时返回带引用的提取式结果。每项改动都用答案支持率、P95 和单请求成本三项指标验收，如果支持率下降超过 2 个百分点就回滚，而不是只追求便宜。";

const drillCapacityEvidence = transcriptEvidence(
  "ev-drill-capacity",
  "drill-1",
  "drill-1-r1",
  revisedDrillAnswer,
  "按十倍流量建立容量表",
);
const drillGuardrailEvidence = transcriptEvidence(
  "ev-drill-guardrail",
  "drill-1",
  "drill-1-r1",
  revisedDrillAnswer,
  "如果支持率下降超过 2 个百分点就回滚",
);

const rawFixture = {
  session: {
    id: "demo-ai-developer",
    state: "REVIEWED",
    language: "zh-CN",
    mode: "quick",
    difficulty: "medium",
    objectiveCount: 4,
    turnBudget: 5,
    followUpBudget: 1,
    roleProfile: {
      id: "ai_application",
      label: "AI 应用开发岗",
      summary:
        "关注模型能力能否通过清晰架构、可验证评估与可靠降级形成可交付产品。",
      competencyWeights: [
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
          description: "说明架构、替代方案、故障边界与取舍。",
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
          description: "把经验映射到模型集成与工程交付职责。",
          weight: 20,
        },
      ],
      requiredSignals: [
        "能够解释端到端请求链路",
        "能够设计离线评估与线上监控",
        "能够在延迟、成本和质量之间做可验证取舍",
        "能够说明超时、模型不可用和流量突增时的降级方案",
      ],
      scenarioConstraints: ["流量扩大十倍，同时推理预算减少一半"],
    },
    candidateBrief: {
      id: "brief-demo-001",
      displayName: "候选人 A",
      roleId: "ai_application",
      headline: "有 LLM 应用与后端服务项目经验的应届开发者",
      education: ["某高校软件工程专业本科"],
      experienceHighlights: ["完成过一套可回放评估的智能知识助手原型"],
      projects: [
        {
          id: "project-knowledge-assistant",
          name: "智能知识助手",
          context: "为内部知识检索场景搭建带引用的问答服务原型。",
          responsibilities: [
            "设计服务 API 与检索生成链路",
            "建立离线回放评估",
            "实现超时降级与阶段监控",
          ],
          technologies: ["TypeScript", "Python", "向量检索", "LLM API"],
          confirmedClaims: [
            "使用 200 条脱敏回放请求做版本比较",
            "将 P95 端到端延迟从 4.8 秒降至 2.6 秒",
          ],
          evidenceRefs: [resumeProjectRef, resumeOwnershipRef],
        },
      ],
      skills: ["TypeScript", "Python", "REST API", "RAG", "Docker"],
      job: {
        title: "AI 应用开发工程师",
        companyLabel: "示例科技团队",
        responsibilities: [
          "集成大模型能力并交付线上功能",
          "建设效果评估、监控和故障降级",
        ],
        requiredSkills: ["TypeScript 或 Python", "LLM 应用开发", "服务可靠性"],
        preferredSkills: ["RAG 评估", "容器化部署"],
        constraints: ["重视延迟与推理成本"],
        evidenceRefs: [jdDeliveryRef, jdReliabilityRef],
      },
      matchHighlights: [
        "有端到端模型服务集成经验",
        "有离线评估与性能优化的可核验项目证据",
      ],
      verificationRisks: [
        "200 条回放数据能否代表真实线上分布",
        "缺少高并发容量与单位成本的量化结果",
      ],
      excludedUnconfirmedItems: ["简历中未说明的线上日活与业务收入"],
      sourceEvidenceRefs: [
        resumeProjectRef,
        resumeOwnershipRef,
        jdDeliveryRef,
        jdReliabilityRef,
      ],
      confirmedAt: "2026-08-30T09:01:00+08:00",
    },
    objectives: [
      {
        id: "objective-motivation",
        order: 1,
        category: "motivation",
        title: "岗位动机与经验映射",
        competencyIds: ["question_response", "job_relevance"],
        sourceEvidenceRefs: [jdDeliveryRef],
        evidenceGoal: "确认候选人的求职动机与 AI 应用交付经验是否一致。",
        openingIntent: "请候选人用近期项目解释为何选择该岗位。",
        maxFollowUps: 0,
        completionCriteria: ["给出岗位动机", "连接至少一项已确认经历"],
        timeBudgetSeconds: 90,
      },
      {
        id: "objective-project",
        order: 2,
        category: "resume_project",
        title: "项目所有权与评估证据",
        competencyIds: ["ownership", "result_evidence"],
        sourceEvidenceRefs: [resumeProjectRef, resumeOwnershipRef],
        evidenceGoal: "区分个人职责，并验证评估数据、指标与局限。",
        openingIntent: "围绕智能知识助手追问请求链路、个人贡献和效果。",
        maxFollowUps: 1,
        completionCriteria: ["说明个人负责范围", "说明评估方法及其局限"],
        timeBudgetSeconds: 240,
      },
      {
        id: "objective-technical",
        order: 3,
        category: "role_technical",
        title: "可靠性设计",
        competencyIds: ["technical_reasoning"],
        sourceEvidenceRefs: [jdReliabilityRef],
        evidenceGoal: "确认候选人能拆分超时边界并设计可观测降级。",
        openingIntent: "给出模型超时场景，要求说明链路策略。",
        maxFollowUps: 0,
        completionCriteria: ["说明分阶段超时", "说明降级与监控"],
        timeBudgetSeconds: 150,
      },
      {
        id: "objective-scenario",
        order: 4,
        category: "applied_scenario",
        title: "容量、成本与质量取舍",
        competencyIds: ["technical_reasoning", "result_evidence"],
        sourceEvidenceRefs: [jdReliabilityRef, roleScenarioRef],
        evidenceGoal: "观察候选人如何在约束变化时提出有验收门槛的方案。",
        openingIntent: "把流量和预算同时改变，要求排序方案与指标。",
        maxFollowUps: 0,
        completionCriteria: ["说明方案顺序", "给出质量护栏和验证方式"],
        timeBudgetSeconds: 180,
      },
    ],
    turns: [
      {
        id: "turn-1",
        index: 1,
        objectiveId: "objective-motivation",
        questionText:
          "请结合最近一个项目，说明你为什么选择 AI 应用开发岗，以及这段经历与岗位要求最直接的连接是什么？",
        questionEvidenceRefs: [jdDeliveryRef],
        isDynamicFollowUp: false,
        transcriptRevisions: [
          {
            revisionId: "turn-1-r1",
            answerSource: "voice",
            rawSttText: answer1,
            confirmedAnswerText: answer1,
            createdAt: "2026-08-30T09:03:10+08:00",
            confirmedAt: "2026-08-30T09:03:22+08:00",
            supersedesRevisionId: null,
            isCurrent: true,
          },
        ],
        confirmedRevisionId: "turn-1-r1",
        answerSource: "voice",
        decision: "advance",
        decisionReason: "已说明动机并连接模型集成、评估与降级经验。",
        createdAt: "2026-08-30T09:02:00+08:00",
        submittedAt: "2026-08-30T09:03:22+08:00",
      },
      {
        id: "turn-2",
        index: 2,
        objectiveId: "objective-project",
        questionText:
          "在智能知识助手中，你本人负责哪一段链路？请从请求进入开始讲到结果返回，并说明你如何判断改动真的有效。",
        questionEvidenceRefs: [resumeProjectRef, resumeOwnershipRef],
        isDynamicFollowUp: false,
        transcriptRevisions: [
          {
            revisionId: "turn-2-r1",
            answerSource: "voice",
            rawSttText: answer2.replace("P95", "p 九五"),
            confirmedAnswerText: answer2,
            createdAt: "2026-08-30T09:04:50+08:00",
            confirmedAt: "2026-08-30T09:05:08+08:00",
            supersedesRevisionId: null,
            isCurrent: true,
          },
        ],
        confirmedRevisionId: "turn-2-r1",
        answerSource: "voice",
        decision: "probe",
        decisionReason: "链路与个人职责清晰，但 200 条评估数据的构造和边界未说明。",
        createdAt: "2026-08-30T09:03:30+08:00",
        submittedAt: "2026-08-30T09:05:08+08:00",
      },
      {
        id: "turn-3",
        index: 3,
        objectiveId: "objective-project",
        questionText:
          "你刚才提到用 200 条回放请求判断版本效果。这 200 条如何构造和切分，怎样避免数据泄漏，它不能证明什么？",
        questionEvidenceRefs: [answer2LatencyEvidence],
        isDynamicFollowUp: true,
        transcriptRevisions: [
          {
            revisionId: "turn-3-r1",
            answerSource: "voice",
            rawSttText: answer3.replace("200", "两百"),
            confirmedAnswerText: answer3.replace("200", "两百"),
            createdAt: "2026-08-30T09:06:30+08:00",
            confirmedAt: "2026-08-30T09:06:42+08:00",
            supersedesRevisionId: null,
            isCurrent: false,
          },
          {
            revisionId: "turn-3-r2",
            answerSource: "voice",
            rawSttText: answer3.replace("200", "两百"),
            confirmedAnswerText: answer3,
            createdAt: "2026-08-30T09:06:50+08:00",
            confirmedAt: "2026-08-30T09:06:54+08:00",
            supersedesRevisionId: "turn-3-r1",
            isCurrent: true,
          },
        ],
        confirmedRevisionId: "turn-3-r2",
        answerSource: "voice",
        decision: "advance",
        decisionReason: "已说明构造、切分、错误类型和离线数据的适用边界。",
        createdAt: "2026-08-30T09:05:16+08:00",
        submittedAt: "2026-08-30T09:06:54+08:00",
      },
      {
        id: "turn-4",
        index: 4,
        objectiveId: "objective-technical",
        questionText:
          "如果生成模型偶发超时，你会如何划分超时边界、设计降级，并用哪些指标判断故障影响？",
        questionEvidenceRefs: [jdReliabilityRef],
        isDynamicFollowUp: false,
        transcriptRevisions: [
          {
            revisionId: "turn-4-r1",
            answerSource: "text",
            rawSttText: null,
            confirmedAnswerText: answer4,
            createdAt: "2026-08-30T09:08:20+08:00",
            confirmedAt: "2026-08-30T09:08:20+08:00",
            supersedesRevisionId: null,
            isCurrent: true,
          },
        ],
        confirmedRevisionId: "turn-4-r1",
        answerSource: "text",
        decision: "advance",
        decisionReason: "覆盖阶段超时、有限重试、可见降级、熔断与分阶段指标。",
        createdAt: "2026-08-30T09:07:02+08:00",
        submittedAt: "2026-08-30T09:08:20+08:00",
      },
      {
        id: "turn-5",
        index: 5,
        objectiveId: "objective-scenario",
        questionText:
          "假设流量扩大十倍、推理预算减少一半，你会按什么顺序调整这套系统？请说明你不会牺牲的质量护栏。",
        questionEvidenceRefs: [jdReliabilityRef, roleScenarioRef],
        isDynamicFollowUp: false,
        transcriptRevisions: [
          {
            revisionId: "turn-5-r1",
            answerSource: "voice",
            rawSttText: answer5,
            confirmedAnswerText: answer5,
            createdAt: "2026-08-30T09:09:40+08:00",
            confirmedAt: "2026-08-30T09:09:49+08:00",
            supersedesRevisionId: null,
            isCurrent: true,
          },
        ],
        confirmedRevisionId: "turn-5-r1",
        answerSource: "voice",
        decision: "finish",
        decisionReason: "达到五轮预算；回答有方向，但缺少容量基线和量化质量护栏。",
        createdAt: "2026-08-30T09:08:28+08:00",
        submittedAt: "2026-08-30T09:09:49+08:00",
      },
    ],
    startedAt: "2026-08-30T09:02:00+08:00",
    completedAt: "2026-08-30T09:09:49+08:00",
  },
  coachReport: {
    id: "report-demo-001",
    sessionId: "demo-ai-developer",
    generatedAt: "2026-08-30T09:10:20+08:00",
    overallReadiness: "developing",
    summary:
      "你能清楚说明个人负责链路、评估边界和故障降级，已具备 AI 应用开发岗的核心表达基础。下一步应把容量与成本取舍从方案清单升级为带基线、阈值和回滚条件的决策。",
    assessments: [
      {
        dimension: "question_response",
        label: "回应问题",
        level: "sufficient",
        evidenceRefs: [answer1Evidence],
        rationale: "开场直接回答求职动机，并把项目经验映射到岗位职责。",
        missingEvidence: [],
        nextAction: "继续保持先给结论、再给项目证据的顺序。",
      },
      {
        dimension: "ownership",
        label: "项目所有权",
        level: "sufficient",
        evidenceRefs: [answer2OwnershipEvidence],
        rationale: "明确说出本人负责 API 与检索生成链路，没有把团队成果全部归为个人。",
        missingEvidence: [],
        nextAction: "补一句与其他成员的接口边界，会让协作范围更完整。",
      },
      {
        dimension: "technical_reasoning",
        label: "技术推理",
        level: "sufficient",
        evidenceRefs: [answer4FallbackEvidence, answer4MetricsEvidence],
        rationale: "降级路径、熔断与分阶段监控构成了完整故障处理链。",
        missingEvidence: [],
        nextAction: "场景题中也使用同样的‘约束—方案—指标—回滚’结构。",
      },
      {
        dimension: "result_evidence",
        label: "结果证据",
        level: "partial",
        evidenceRefs: [
          answer2LatencyEvidence,
          answer3DatasetEvidence,
          answer3LimitEvidence,
        ],
        rationale: "有延迟结果和数据集构造说明，也主动承认离线分布限制；但缺少质量变化和线上容量证据。",
        missingEvidence: ["优化前后的答案质量护栏", "吞吐与单位成本基线"],
        nextAction: "为性能优化补充至少一项质量指标和一项资源成本指标。",
      },
      {
        dimension: "job_relevance",
        label: "岗位相关性",
        level: "sufficient",
        evidenceRefs: [answer1Evidence, answer4FallbackEvidence],
        rationale: "回答持续围绕模型集成、评估和可靠性，和目标 JD 的核心职责一致。",
        missingEvidence: [],
        nextAction: "后续准备一个真实部署或协作交付案例，增强生产环境可信度。",
      },
    ],
    priorityActions: [
      "重答十倍流量场景：先给容量基线，再排序方案。",
      "所有降本方案同时给出质量护栏与回滚阈值。",
      "在简历项目中补充已确认的评估规模和 P95 延迟结果。",
    ],
    questionReviews: [
      {
        turnId: "turn-1",
        evidenceRefs: [answer1Evidence],
        strengths: ["动机明确", "经验与岗位要求连接自然"],
        gaps: ["尚未说明更长期的成长方向"],
        nextAction: "用一句话补充希望承担的 AI 应用交付责任。",
      },
      {
        turnId: "turn-2",
        evidenceRefs: [answer2OwnershipEvidence, answer2LatencyEvidence],
        strengths: ["请求链路完整", "个人职责和延迟结果清晰"],
        gaps: ["首次回答未解释评估数据如何产生"],
        nextAction: "项目介绍中主动交代评估集来源和一项局限。",
      },
      {
        turnId: "turn-3",
        evidenceRefs: [answer3DatasetEvidence, answer3LimitEvidence],
        strengths: ["说明分层切分", "主动限定离线结论边界"],
        gaps: ["未说明人工标注一致性"],
        nextAction: "补充标注规则或抽检方式，避免评估标准漂移。",
      },
      {
        turnId: "turn-4",
        evidenceRefs: [answer4FallbackEvidence, answer4MetricsEvidence],
        strengths: ["故障边界清楚", "降级对用户可见", "监控粒度合理"],
        gaps: [],
        nextAction: "补一个熔断恢复条件即可形成更完整的状态闭环。",
      },
      {
        turnId: "turn-5",
        evidenceRefs: [answer5TradeoffEvidence, answer5GapEvidence],
        strengths: ["提出缓存、分层路由和并发保护"],
        gaps: ["没有当前容量基线", "没有量化质量护栏", "方案顺序缺少验收门槛"],
        nextAction: "按容量基线、方案顺序、三项指标和回滚条件重新回答。",
      },
    ],
    resumeSuggestions: [
      {
        sourceEvidenceRefs: [resumeProjectRef, resumeOwnershipRef],
        originalClaim: "负责智能知识助手开发，优化服务响应速度。",
        suggestion:
          "负责智能知识助手的 API、混合检索与离线评估；基于 200 条脱敏回放请求验证，将 P95 端到端延迟从 4.8 秒降至 2.6 秒。",
        needsUserConfirmation: false,
      },
      {
        sourceEvidenceRefs: [resumeProjectRef],
        originalClaim: "使用离线数据评估问答效果。",
        suggestion:
          "构建 200 条脱敏回放请求的离线评估集，按无答案、错引和检索遗漏分析失败案例；线上分布代表性仍待真实流量验证。",
        needsUserConfirmation: false,
      },
    ],
  },
  drillAttempt: {
    id: "drill-1",
    sessionId: "demo-ai-developer",
    sourceTurnId: "turn-5",
    objectiveId: "objective-scenario",
    prompt:
      "再次回答十倍流量、预算减半的场景。请不要新增未经确认的历史成绩，而是说明你会先测什么、如何排序，以及用什么条件验收。",
    checklist: [
      "先给容量与成本基线",
      "按影响和风险排序方案",
      "同时给质量护栏与回滚条件",
    ],
    submittedAt: "2026-08-30T09:14:00+08:00",
    transcriptRevision: {
      revisionId: "drill-1-r1",
      answerSource: "voice",
      rawSttText: revisedDrillAnswer.replace("P95", "p 九五"),
      confirmedAnswerText: revisedDrillAnswer,
      createdAt: "2026-08-30T09:13:48+08:00",
      confirmedAt: "2026-08-30T09:14:00+08:00",
      supersedesRevisionId: null,
      isCurrent: true,
    },
    comparison: {
      verdict: "improved",
      summary:
        "重答新增了容量基线、分层条件、质量指标和回滚阈值；仍需在真实压测后填写具体吞吐与成本结果。",
      beforeEvidenceRefs: [answer5TradeoffEvidence, answer5GapEvidence],
      afterEvidenceRefs: [drillCapacityEvidence, drillGuardrailEvidence],
      evidenceAdded: ["容量规划步骤", "质量下降 2 个百分点的回滚条件"],
      remainingGaps: ["真实吞吐基线", "单位请求成本"],
    },
  },
} as const;

/**
 * Parsing at module load keeps the offline demo honest: UI fixtures use the
 * exact same contracts as API responses and fail fast during typecheck/build.
 */
export const demoSessionFixture = DemoSessionFixtureSchema.parse(rawFixture);

export const demoInterviewSession = demoSessionFixture.session;
export const demoRoleProfile = demoInterviewSession.roleProfile;
export const demoCandidateBrief = demoInterviewSession.candidateBrief;
export const demoCoachReport = demoSessionFixture.coachReport;
export const demoDrillAttempt = demoSessionFixture.drillAttempt;
