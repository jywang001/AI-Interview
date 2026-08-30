import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { DemoBanner } from "@/components/demo-banner";
import { FlowProgress } from "@/components/flow-progress";
import { PresenterCard } from "@/components/presenter-card";
import { VoiceRecorder } from "@/components/voice-recorder";
import { demoInterviewSession } from "@/fixtures/demo-session";

export const metadata: Metadata = {
  title: "模拟面试",
};

type InterviewPageProps = {
  params: Promise<{ id: string }>;
};

export default async function InterviewPage({ params }: InterviewPageProps) {
  const { id } = await params;
  if (id !== demoInterviewSession.id) notFound();

  const turn = demoInterviewSession.turns[1];
  const revision = turn.transcriptRevisions.find((item) => item.isCurrent);

  return (
    <AppShell active="interview">
      <main className="interview-page">
        <FlowProgress current="interview" />
        <DemoBanner />
        <div className="interview-topline">
          <div className="session-progress" aria-label="第 2 轮，共 5 轮">
            {[1, 2, 3, 4, 5].map((step) => (
              <i
                className={
                  step < 2 ? "is-complete" : step === 2 ? "is-current" : undefined
                }
                key={step}
              />
            ))}
          </div>
          <span>SESSION {id.toUpperCase()} · TURN 02 / 05</span>
        </div>

        <div className="interview-layout">
          <PresenterCard state="speaking" />
          <div className="interview-main">
            <section className="question-card">
              <div className="question-kicker">
                <span>PROJECT DEEP DIVE</span>
                <span>目标 02 · 项目所有权与评估证据</span>
              </div>
              <h1>{turn.questionText}</h1>
              <div className="source-reference">
                <span>问题来源</span>
                {turn.questionEvidenceRefs[0]?.excerpt}
              </div>
            </section>

            <VoiceRecorder
              initialTranscript={revision?.confirmedAnswerText ?? ""}
              question={turn.questionText}
            />

            <Link
              className="button button-secondary"
              href={"/report/" + demoInterviewSession.id}
            >
              演示：跳至完整五轮记录
              <span>→</span>
            </Link>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
