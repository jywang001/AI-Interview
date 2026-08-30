import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { InterviewReportDetail } from "@/components/interview-report-detail";

export const metadata: Metadata = {
  title: "面试复盘",
};

type ReportPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ReportPage({ params }: ReportPageProps) {
  const { id } = await params;

  return (
    <AppShell active="report">
      <main className="report-page">
        <InterviewReportDetail reportId={id} />
      </main>
    </AppShell>
  );
}
