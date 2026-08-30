"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  LiveCoachReportSchema,
  LiveInterviewSessionSchema,
} from "@/lib/interview/live-schemas";
import { getTrainingReadiness } from "@/lib/interview/readiness";

const SESSION_STORAGE_KEY = "ai-interview:live-session:v1";
const REPORT_STORAGE_KEY = "ai-interview:live-report:v1";
type ReviewRecord = {
  id: string;
  title: string;
  role: string;
  date: string;
  score: number;
  isDemo?: boolean;
};

const DEMO_RECORD: ReviewRecord = {
  id: "demo-ai-developer",
  title: "AI 应用开发岗模拟面试",
  role: "快速模式 · 六阶段",
  date: "复盘示例",
  score: 86,
  isDemo: true,
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function ReviewHub() {
  const [latestRecord, setLatestRecord] = useState<ReviewRecord | null>(null);
  const [latestExport, setLatestExport] = useState<Record<string, unknown> | null>(
    null,
  );

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
        session.data.id === report.data.sessionId
      ) {
        setLatestExport({
          exportedAt: new Date().toISOString(),
          session: session.data,
          report: report.data,
        });
        setLatestRecord({
          id: report.data.sessionId,
          title: `${session.data.candidateBrief.job.title}模拟面试`,
          role: `${session.data.mode === "realistic" ? "真实模式" : "快速模式"} · ${session.data.turns.length} 轮对话`,
          date: formatDate(report.data.generatedAt),
          score: report.data.overallScore,
        });
      }
    } catch {
      setLatestRecord(null);
    }
  }, []);

  function downloadLatestRecord() {
    if (!latestRecord || !latestExport) return;

    const blob = new Blob([JSON.stringify(latestExport, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `ai-interview-${latestRecord.id}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(downloadUrl);
  }

  return (
    <section className="review-hub" aria-labelledby="review-hub-title">
      <header className="review-heading">
        <div>
          <p className="eyebrow">复盘提升</p>
          <h1 id="review-hub-title">面试记录</h1>
        </div>
        <p>选择一场面试，查看评分和逐轮建议。</p>
      </header>

      {latestRecord && (
        <button
          className="button button-secondary"
          onClick={downloadLatestRecord}
          type="button"
        >
          导出最近记录 JSON
        </button>
      )}

      <div className="review-records">
        {latestRecord && <ReviewRecordCard record={latestRecord} />}
        <ReviewRecordCard record={DEMO_RECORD} />
      </div>
    </section>
  );
}

function ReviewRecordCard({ record }: { record: ReviewRecord }) {
  const readiness = getTrainingReadiness(record.score);

  return (
    <Link className="review-record-card" href={`/report/${record.id}`}>
      <div className="review-record-main">
        <div className="review-record-meta">
          <span>{record.date}</span>
          {record.isDemo && <span className="record-demo-label">示例</span>}
        </div>
        <h2>{record.title}</h2>
        <p>{record.role}</p>
      </div>
      <div className="review-record-result">
        <strong>{record.score}</strong>
        <span className={`result-pill ${readiness.className}`}>
          {readiness.label}
        </span>
      </div>
      <span className="review-record-arrow" aria-hidden="true">→</span>
    </Link>
  );
}
