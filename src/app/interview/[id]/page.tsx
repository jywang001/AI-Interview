import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { DemoBanner } from "@/components/demo-banner";
import { FlowProgress } from "@/components/flow-progress";
import { LiveInterviewSession } from "@/components/live-interview-session";
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

  return (
    <AppShell active="interview">
      <main className="interview-page">
        <FlowProgress current="interview" />
        <DemoBanner />
        <LiveInterviewSession demoSession={demoInterviewSession} />
      </main>
    </AppShell>
  );
}
