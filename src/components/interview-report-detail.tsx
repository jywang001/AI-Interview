"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  REPORT_CRITERIA,
  LiveCoachReportSchema,
  LiveInterviewSessionSchema,
  type LiveCoachReport,
  type LiveInterviewSession,
} from "@/lib/interview/live-schemas";

const SESSION_STORAGE_KEY = "ai-interview:live-session:v1";
const REPORT_STORAGE_KEY = "ai-interview:live-report:v1";
const DEMO_REPORT_ID = "demo-ai-developer";
const PASS_SCORE = 85;

const CRITERIA_LABELS = {
  directness: "回答针对性",
  specificity: "内容具体度",
  reasoning: "技术推理",
  correctness: "技术正确性",
  relevance: "岗位匹配",
  communication: "表达清晰度",
  reflection: "复盘意识",
} as const;

type CriterionKey = keyof typeof CRITERIA_LABELS;

type DialogueView = {
  id: string;
  question: string;
  answer: string;
  quote?: string;
  comment: string;
};

type StageView = {
  id: string;
  title: string;
  score: number;
  stars: number;
  rationale: string;
  strengths: string[];
  gaps: string[];
  nextAction: string;
  dialogues: DialogueView[];
};

type ReviewView = {
  id: string;
  title: string;
  mode: string;
  date: string;
  score: number;
  summary: string;
  dimensions: Array<{ key: CriterionKey; label: string; stars: number }>;
  priorities: string[];
  stages: StageView[];
};

const DEMO_STAGES: StageView[] = [
  {
    id: "self_intro",
    title: "自我介绍",
    score: 88,
    stars: 4,
    rationale: "经历与岗位衔接清楚，但开场还可以更快给出个人定位。",
    strengths: ["在一分钟内交代了核心项目和求职方向"],
    gaps: ["没有用一句话概括自己最突出的能力标签"],
    nextAction: "把前两句改成“定位 + 年限/经历 + 一个代表结果”。",
    dialogues: [
      {
        id: "demo-1",
        question: "请用一分钟介绍一下自己，并说说为什么适合这个岗位。",
        answer: "我主要做大模型应用开发，最近完成了一个企业知识助手，负责 RAG 链路、服务部署和线上性能优化。项目上线后，回答延迟和稳定性都有明显改善。",
        quote: "负责 RAG 链路、服务部署和线上性能优化",
        comment: "职责范围说得具体，是有效信息；如果补上量化结果，开场会更有说服力。",
      },
    ],
  },
  {
    id: "resume_deep_dive",
    title: "简历项目深挖",
    score: 90,
    stars: 5,
    rationale: "能够区分个人贡献与团队工作，并给出性能优化的完整链路。",
    strengths: ["个人职责清楚", "能够解释结果是如何测得的"],
    gaps: ["异常场景与失败尝试讲得偏少"],
    nextAction: "补一个失败方案和最终取舍，证明方案不是事后包装。",
    dialogues: [
      {
        id: "demo-2",
        question: "P95 延迟从 4.8 秒降到 2.6 秒，具体哪部分是你完成的？",
        answer: "我先拆解了检索、重排和生成耗时，发现生成阶段占比最高。之后我调整了上下文裁剪策略并增加流式返回，压测口径保持 200 条固定问题不变。",
        quote: "压测口径保持 200 条固定问题不变",
        comment: "说明了对照口径，结果可信；继续补充流量规模和硬件环境会更完整。",
      },
    ],
  },
  {
    id: "role_knowledge",
    title: "岗位知识",
    score: 84,
    stars: 4,
    rationale: "理解 RAG 评估和服务稳定性，但对选型边界的解释还不够深入。",
    strengths: ["能把离线评估和线上监控分开讨论"],
    gaps: ["没有说明何时不应该使用向量检索"],
    nextAction: "用数据规模、更新频率、召回要求三个条件解释技术选型。",
    dialogues: [
      {
        id: "demo-3",
        question: "你会怎样评估一个 RAG 系统是否真的变好了？",
        answer: "离线看召回率、答案相关性和事实一致性，线上看用户追问率、响应延迟和失败率，同时保留 bad case 做固定回归。",
        quote: "保留 bad case 做固定回归",
        comment: "已经形成闭环意识；下一步要讲清指标权重以及上线阈值。",
      },
    ],
  },
  {
    id: "algorithm_reasoning",
    title: "算法思路",
    score: 82,
    stars: 4,
    rationale: "主思路正确，但边界条件和复杂度分析出现得太晚。",
    strengths: ["能快速识别双指针思路"],
    gaps: ["没有主动覆盖空输入和重复值"],
    nextAction: "固定按“澄清输入—主思路—复杂度—边界用例”四步表达。",
    dialogues: [
      {
        id: "demo-4",
        question: "请讲一下无重复字符的最长子串的解题思路。",
        answer: "我会用滑动窗口，右指针扩张，遇到重复字符后移动左指针，并用哈希表记录字符最近出现的位置，整体只遍历一次。",
        quote: "用哈希表记录字符最近出现的位置",
        comment: "核心数据结构正确；要强调左指针不能回退，并主动给出 O(n) 复杂度。",
      },
    ],
  },
  {
    id: "motivation_availability",
    title: "岗位动机与到岗",
    score: 87,
    stars: 4,
    rationale: "岗位动机与过往经历有关联，到岗信息也回答完整。",
    strengths: ["选择岗位的理由不是泛泛而谈"],
    gaps: ["对未来一年希望补足的能力描述较弱"],
    nextAction: "把岗位选择与下一阶段能力目标连起来。",
    dialogues: [
      {
        id: "demo-5",
        question: "为什么选择 AI 应用开发岗？什么时候可以到岗？",
        answer: "我喜欢把模型能力做成可稳定交付的产品，这和我之前的项目最匹配。我两周后可以到岗，能够连续实习六个月。",
        quote: "把模型能力做成可稳定交付的产品",
        comment: "动机与岗位工作方式匹配；若再补一个具体成长目标，会更有辨识度。",
      },
    ],
  },
  {
    id: "candidate_questions",
    title: "候选人反问",
    score: 85,
    stars: 4,
    rationale: "问题关注真实工作和评价标准，体现了岗位投入度。",
    strengths: ["问题具体且能帮助判断岗位匹配"],
    gaps: ["可以再追问团队当前最难的问题"],
    nextAction: "准备一个业务问题、一个协作问题和一个成长问题。",
    dialogues: [
      {
        id: "demo-6",
        question: "你有什么想了解的吗？",
        answer: "这个岗位前三个月最重要的交付是什么？团队通常怎样评估一个 AI 功能是否值得继续投入？",
        quote: "前三个月最重要的交付",
        comment: "问题直指预期和评价标准，是高质量反问。",
      },
    ],
  },
];

const DEMO_VIEW: ReviewView = {
  id: DEMO_REPORT_ID,
  title: "AI 应用开发岗模拟面试",
  mode: "快速模式 · 9 轮对话",
  date: "复盘示例",
  score: 86,
  summary: "项目经历有说服力，岗位理解也比较扎实。主要短板是算法表达的完整性，以及技术选型时对边界条件的说明。",
  dimensions: [
    { key: "directness", label: CRITERIA_LABELS.directness, stars: 5 },
    { key: "specificity", label: CRITERIA_LABELS.specificity, stars: 4 },
    { key: "reasoning", label: CRITERIA_LABELS.reasoning, stars: 4 },
    { key: "correctness", label: CRITERIA_LABELS.correctness, stars: 4 },
    { key: "relevance", label: CRITERIA_LABELS.relevance, stars: 5 },
    { key: "communication", label: CRITERIA_LABELS.communication, stars: 4 },
    { key: "reflection", label: CRITERIA_LABELS.reflection, stars: 4 },
  ],
  priorities: [
    "算法题先讲边界与复杂度，再展开实现细节。",
    "项目回答补充一个失败方案，说明为什么最终方案更合适。",
    "技术选型使用明确条件和阈值，不只罗列工具名称。",
  ],
  stages: DEMO_STAGES,
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function toStars(value: number) {
  return Math.max(1, Math.min(5, Math.round((value / 4) * 5)));
}

function buildLiveView(
  report: LiveCoachReport,
  session: LiveInterviewSession,
): ReviewView {
  const dimensions = REPORT_CRITERIA.map((key) => {
    const average =
      report.stageReports.reduce((sum, stage) => sum + stage.criteria[key], 0) /
      report.stageReports.length;
    return { key, label: CRITERIA_LABELS[key], stars: toStars(average) };
  });

  return {
    id: report.sessionId,
    title: `${session.candidateBrief.job.title}模拟面试`,
    mode: `${session.mode === "realistic" ? "真实模式" : "快速模式"} · ${session.turns.length} 轮对话`,
    date: formatDate(report.generatedAt),
    score: report.overallScore,
    summary: report.summary,
    dimensions,
    priorities: report.priorityActions,
    stages: report.stageReports.map((stage) => {
      const stageTurns = session.turns.filter((turn) => turn.stageId === stage.stageId);
      return {
        id: stage.stageId,
        title: stage.title,
        score: stage.score,
        stars: stage.stars,
        rationale: stage.rationale,
        strengths: stage.strengths,
        gaps: stage.gaps,
        nextAction: stage.nextAction,
        dialogues: stageTurns.map((turn) => {
          const evidence = stage.evidence.find((item) => item.turnId === turn.id);
          return {
            id: turn.id,
            question: turn.questionText,
            answer: turn.confirmedAnswerText,
            quote: evidence?.quote,
            comment: turn.assessment.decisionSummary,
          };
        }),
      };
    }),
  };
}

function StarRating({ value }: { value: number }) {
  return (
    <span className="star-rating" aria-label={`${value} 星（满分 5 星）`}>
      <span>{"★".repeat(value)}</span>{"☆".repeat(5 - value)}
    </span>
  );
}

function HighlightedAnswer({ answer, quote }: { answer: string; quote?: string }) {
  if (!quote) return <>{answer}</>;
  const start = answer.indexOf(quote);
  if (start < 0) return <>{answer}</>;

  return (
    <>
      {answer.slice(0, start)}
      <mark>{quote}</mark>
      {answer.slice(start + quote.length)}
    </>
  );
}

export function InterviewReportDetail({ reportId }: { reportId: string }) {
  const [liveView, setLiveView] = useState<ReviewView | null>(null);
  const [resolved, setResolved] = useState(reportId === DEMO_REPORT_ID);

  useEffect(() => {
    try {
      const rawSession = window.localStorage.getItem(SESSION_STORAGE_KEY);
      const rawReport = window.localStorage.getItem(REPORT_STORAGE_KEY);
      const session = rawSession
        ? LiveInterviewSessionSchema.safeParse(JSON.parse(rawSession))
        : null;
      const report = rawReport
        ? LiveCoachReportSchema.safeParse(JSON.parse(rawReport))
        : null;

      if (
        session?.success &&
        report?.success &&
        report.data.sessionId === reportId &&
        session.data.id === reportId
      ) {
        setLiveView(buildLiveView(report.data, session.data));
      }
    } catch {
      setLiveView(null);
    } finally {
      setResolved(true);
    }
  }, [reportId]);

  const view = useMemo(
    () => liveView ?? (reportId === DEMO_REPORT_ID ? DEMO_VIEW : null),
    [liveView, reportId],
  );

  if (!resolved) return <p className="review-loading">正在读取复盘…</p>;

  if (!view) {
    return (
      <section className="review-empty">
        <h1>没有找到这场复盘</h1>
        <p>这份记录可能已被浏览器清除。</p>
        <Link className="button button-primary" href="/reports">返回面试记录</Link>
      </section>
    );
  }

  const passed = view.score >= PASS_SCORE;

  return (
    <article className="review-detail">
      <Link className="review-back" href="/reports">← 返回面试记录</Link>

      <section className="review-result-hero">
        <div className="review-score-block">
          <span>综合得分</span>
          <strong>{view.score}</strong>
          <small>/ 100</small>
        </div>
        <div className="review-result-copy">
          <div className="review-title-row">
            <span className={passed ? "result-pill is-pass" : "result-pill is-fail"}>
              {passed ? "通过" : "未通过"}
            </span>
            <span>85 分为通过线</span>
          </div>
          <h1>{view.title}</h1>
          <p className="review-meta">{view.date} · {view.mode}</p>
          <p className="review-summary">{view.summary}</p>
        </div>
      </section>

      <section className="review-section" aria-labelledby="coach-dimensions-title">
        <div className="review-section-heading">
          <div>
            <p className="eyebrow">能力评分</p>
            <h2 id="coach-dimensions-title">能力维度</h2>
          </div>
          <span>满分 5 星</span>
        </div>
        <div className="coach-dimensions">
          {view.dimensions.map((dimension) => (
            <div className="coach-dimension" key={dimension.key}>
              <span>{dimension.label}</span>
              <StarRating value={dimension.stars} />
            </div>
          ))}
        </div>
      </section>

      <section className="review-section review-priorities" aria-labelledby="priority-title">
        <div className="review-section-heading">
          <div>
            <p className="eyebrow">下一步</p>
            <h2 id="priority-title">优先改进这 {view.priorities.length} 件事</h2>
          </div>
        </div>
        <ol>
          {view.priorities.map((priority) => <li key={priority}>{priority}</li>)}
        </ol>
      </section>

      <section className="review-section" aria-labelledby="stage-review-title">
        <div className="review-section-heading">
          <div>
            <p className="eyebrow">逐阶段复盘</p>
            <h2 id="stage-review-title">展开查看对话与点评</h2>
          </div>
          <span>{view.stages.length} 个阶段</span>
        </div>

        <div className="stage-review-list">
          {view.stages.map((stage, index) => (
            <details className="stage-review" key={stage.id} open={index === 0}>
              <summary>
                <span className="stage-review-index">{String(index + 1).padStart(2, "0")}</span>
                <span className="stage-review-name">
                  <strong>{stage.title}</strong>
                  <small>{stage.rationale}</small>
                </span>
                <StarRating value={stage.stars} />
                <strong className="stage-review-score">{stage.score}</strong>
                <i aria-hidden="true">＋</i>
              </summary>

              <div className="stage-review-body">
                <div className="stage-findings">
                  <div>
                    <span>做得好</span>
                    <p>{stage.strengths.join("；") || "本阶段基础回答完整。"}</p>
                  </div>
                  <div>
                    <span>需要补强</span>
                    <p>{stage.gaps.join("；") || "暂未发现明显问题。"}</p>
                  </div>
                </div>

                <div className="dialogue-analysis">
                  {stage.dialogues.length > 0 ? stage.dialogues.map((dialogue) => (
                    <article className="dialogue-turn" key={dialogue.id}>
                      <div className="dialogue-line is-question">
                        <span>面试官</span>
                        <p>{dialogue.question}</p>
                      </div>
                      <div className="dialogue-line is-answer">
                        <span>你</span>
                        <p><HighlightedAnswer answer={dialogue.answer} quote={dialogue.quote} /></p>
                      </div>
                      <div className="coach-comment">
                        <span>回答点评</span>
                        <p>{dialogue.comment}</p>
                      </div>
                    </article>
                  )) : (
                    <p className="no-dialogue">本阶段暂无可展示的对话。</p>
                  )}
                </div>

                <div className="stage-next-action">
                  <span>建议这样练</span>
                  <p>{stage.nextAction}</p>
                </div>
              </div>
            </details>
          ))}
        </div>
      </section>
    </article>
  );
}
