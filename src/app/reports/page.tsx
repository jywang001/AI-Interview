import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { ReviewHub } from "@/components/review-hub";

export const metadata: Metadata = {
  title: "复盘提升",
};

export default function ReportsPage() {
  return (
    <AppShell active="report">
      <main className="report-page">
        <ReviewHub />
      </main>
    </AppShell>
  );
}
