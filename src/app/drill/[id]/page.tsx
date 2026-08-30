import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { DemoBanner } from "@/components/demo-banner";
import { FlowProgress } from "@/components/flow-progress";
import {
  demoDrillAttempt,
  demoInterviewSession,
} from "@/fixtures/demo-session";

export const metadata: Metadata = {
  title: "定向重练",
};

type DrillPageProps = {
  params: Promise<{ id: string }>;
};

export default async function DrillPage({ params }: DrillPageProps) {
  const { id } = await params;
  if (id !== demoInterviewSession.id) notFound();

  const sourceTurn = demoInterviewSession.turns.find(
    (turn) => turn.id === demoDrillAttempt.sourceTurnId,
  );
  const before = sourceTurn?.transcriptRevisions.find((item) => item.isCurrent);
  const after = demoDrillAttempt.transcriptRevision;

  return (
    <AppShell active="report">
      <main className="report-page">
        <FlowProgress current="drill" />
        <DemoBanner />

        <header className="workspace-heading">
          <div>
            <p className="eyebrow">针对性重练</p>
            <h1>不是换一道题，而是补上同一个证据缺口。</h1>
          </div>
          <p>{demoDrillAttempt.prompt}</p>
        </header>

        <section className="report-panel">
          <div className="panel-title">
            <div>
              <p>回答前检查</p>
              <h2>本轮只关注三个检查点</h2>
            </div>
            <span className="status-pill">同一目标</span>
          </div>
          <ul className="drill-checklist">
            {demoDrillAttempt.checklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="report-panel">
          <div className="panel-title">
            <div>
              <p>回答对比</p>
              <h2>初答与重答的证据变化</h2>
            </div>
            <span className="status-pill">确有改善</span>
          </div>

          <div className="comparison-grid">
            <article className="attempt-card">
              <span>初次回答</span>
              <blockquote>{before?.confirmedAnswerText}</blockquote>
              <ul className="delta-list">
                {demoDrillAttempt.comparison.remainingGaps.map((gap) => (
                  <li key={gap}>仍缺：{gap}</li>
                ))}
              </ul>
            </article>

            <article className="attempt-card is-new">
              <span>重练回答</span>
              <blockquote>{after.confirmedAnswerText}</blockquote>
              <ul className="delta-list">
                {demoDrillAttempt.comparison.evidenceAdded.map((item) => (
                  <li className="is-added" key={item}>
                    新增：{item}
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </section>

        <section className="closing-cta">
          <div>
            <p className="eyebrow">对比结果</p>
            <h2>{demoDrillAttempt.comparison.summary}</h2>
          </div>
          <Link
            className="button button-light button-large"
            href={"/report/" + demoInterviewSession.id}
          >
            返回完整复盘
            <span>→</span>
          </Link>
        </section>
      </main>
    </AppShell>
  );
}
