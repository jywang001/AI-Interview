import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { DemoBanner } from "@/components/demo-banner";
import { FlowProgress } from "@/components/flow-progress";
import {
  demoCoachReport,
  demoInterviewSession,
} from "@/fixtures/demo-session";

export const metadata: Metadata = {
  title: "证据复盘",
};

const levelCopy = {
  sufficient: { label: "证据充分", className: "level-strong" },
  partial: { label: "部分体现", className: "level-partial" },
  not_shown: { label: "未体现", className: "level-missing" },
} as const;

type ReportPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ReportPage({ params }: ReportPageProps) {
  const { id } = await params;
  if (id !== demoInterviewSession.id) notFound();

  const focusReview = demoCoachReport.questionReviews.at(-1);
  const focusTurn = demoInterviewSession.turns.at(-1);
  const evidence = focusReview?.evidenceRefs[0];
  const sufficientCount = demoCoachReport.assessments.filter(
    (item) => item.level === "sufficient",
  ).length;

  return (
    <AppShell active="report">
      <main className="report-page">
        <FlowProgress current="report" />
        <DemoBanner />

        <section className="report-hero">
          <div>
            <p className="eyebrow">COACH REVIEW / {id.toUpperCase()}</p>
            <h1>基础已经够清楚，下一步要让每个方案都有验收门槛。</h1>
            <p>{demoCoachReport.summary}</p>
          </div>
          <div className="report-meter">
            <span>EVIDENCE COVERAGE</span>
            <strong>{sufficientCount} / 5</strong>
            <small>这是证据覆盖计数，不是录取分数或能力百分比。</small>
          </div>
        </section>

        <div className="report-grid">
          <aside className="report-sidebar">
            <section className="report-panel">
              <h2>优先改进任务</h2>
              <ol className="priority-list">
                {demoCoachReport.priorityActions.map((action) => (
                  <li key={action}>{action}</li>
                ))}
              </ol>
            </section>

            <section className="report-panel">
              <h2>能力证据概览</h2>
              <div className="competency-list">
                {demoCoachReport.assessments.map((assessment) => {
                  const level = levelCopy[assessment.level];
                  return (
                    <div className="competency-row" key={assessment.dimension}>
                      <strong>{assessment.label}</strong>
                      <span className={level.className}>{level.label}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="report-panel">
              <h2>简历建议</h2>
              <ul className="suggestion-list">
                {demoCoachReport.resumeSuggestions.map((suggestion) => (
                  <li key={suggestion.originalClaim}>
                    <strong>原文：{suggestion.originalClaim}</strong>
                    <span>{suggestion.suggestion}</span>
                    <small>
                      {suggestion.needsUserConfirmation
                        ? "包含待用户确认事实"
                        : "仅使用已确认材料"}
                    </small>
                  </li>
                ))}
              </ul>
            </section>
          </aside>

          <div className="report-detail">
            <section className="question-review">
              <div className="review-header">
                <div>
                  <p>FOCUS REVIEW · TURN 05 / 05</p>
                  <h2>{focusTurn?.questionText}</h2>
                </div>
                <span className="status-pill">部分体现</span>
              </div>

              <blockquote className="evidence-quote">
                <p>“{evidence?.excerpt}”</p>
                <small>
                  confirmed_answer_text · {evidence?.revisionId} · 字符区间{" "}
                  {evidence?.startOffset}–{evidence?.endOffset}
                </small>
              </blockquote>

              <div className="evidence-columns">
                <div>
                  <h3>已经提供</h3>
                  <p>{focusReview?.strengths.join("；")}</p>
                </div>
                <div>
                  <h3>仍然缺少</h3>
                  <p>{focusReview?.gaps.join("；")}</p>
                </div>
              </div>
            </section>

            <section className="report-panel">
              <div className="panel-title">
                <div>
                  <p>NEXT ACTION</p>
                  <h2>用同一目标重答，验证是否真的补上证据。</h2>
                </div>
                <span className="status-pill">推荐</span>
              </div>
              <Link
                className="button button-primary"
                href={"/drill/" + demoInterviewSession.id}
              >
                重练最薄弱问题
                <span>→</span>
              </Link>
            </section>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
