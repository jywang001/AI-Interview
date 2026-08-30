"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ElapsedWait } from "@/components/elapsed-wait";
import { PresenterCard } from "@/components/presenter-card";
import {
  VoiceRecorder,
  type ConfirmedAnswer,
} from "@/components/voice-recorder";
import {
  LiveCoachReportSchema,
  LiveInterviewSessionSchema,
  LiveInterviewTurnSchema,
  type InterviewMode,
  type LiveCoachReport,
  type LiveInterviewSession as LiveSession,
} from "@/lib/interview/live-schemas";
import {
  buildRoleProfile,
  createLiveInterviewSession,
  INTERVIEW_MODE_COPY,
} from "@/lib/interview/live-stages";
import {
  CandidateBriefSchema,
  type CandidateBrief,
  type InterviewSession,
  type RoleProfile,
} from "@/lib/interview/schemas";

const SESSION_STORAGE_KEY = "ai-interview:live-session:v1";
const REPORT_STORAGE_KEY = "ai-interview:live-report:v1";
const CANDIDATE_BRIEF_STORAGE_KEY = "ai-interview:candidate-brief:v1";
const INTERVIEW_RESPONSE_TIMEOUT_MS = 45_000;
const REPORT_TIMEOUT_MS = 60_000;

type LiveInterviewSessionProps = {
  demoSession: InterviewSession;
};

type InterviewResponsePayload = {
  ok?: boolean;
  message?: string;
  turn?: unknown;
  publicReaction?: string;
  nextStageIndex?: number;
  nextQuestionText?: string | null;
  closingMessage?: string | null;
  interviewFinished?: boolean;
};

type ReportResponsePayload = {
  ok?: boolean;
  message?: string;
  report?: unknown;
};

type PendingSubmission = {
  signature: string;
  requestId: string;
};

function createClientId(prefix: string) {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid
    ? `${prefix}-${uuid}`
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function persistSession(session: LiveSession) {
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

function formatCountdown(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

const DIFFICULTY_LABELS = {
  easy: "简单",
  medium: "中等",
  hard: "困难",
} as const;

function InterviewCompletion({ report }: { report: LiveCoachReport }) {
  const passed = report.overallScore >= 85;

  return (
    <section className="interview-completion" aria-labelledby="completion-title">
      <div className="completion-score">
        <span>综合得分</span>
        <strong>{report.overallScore}</strong>
        <small>/ 100</small>
      </div>
      <div className="completion-copy">
        <div>
          <span className={passed ? "result-pill is-pass" : "result-pill is-fail"}>
            {passed ? "通过" : "未通过"}
          </span>
          <span className="completion-threshold">85 分为通过线</span>
        </div>
        <h1 id="completion-title">本场面试已完成</h1>
        <p>{report.summary}</p>
        <div className="completion-actions">
          <Link className="button button-primary" href={`/report/${report.sessionId}`}>
            查看完整复盘 <span aria-hidden="true">→</span>
          </Link>
          <Link className="button button-secondary" href="/reports">
            返回面试记录
          </Link>
        </div>
      </div>
    </section>
  );
}

export function LiveInterviewSession({ demoSession }: LiveInterviewSessionProps) {
  const [session, setSession] = useState<LiveSession | null>(null);
  const [report, setReport] = useState<LiveCoachReport | null>(null);
  const [contextError, setContextError] = useState("");
  const [candidateBrief, setCandidateBrief] = useState<CandidateBrief>(
    demoSession.candidateBrief,
  );
  const [roleProfile, setRoleProfile] = useState<RoleProfile>(
    demoSession.roleProfile,
  );
  const [hasRestored, setHasRestored] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isPresenterSpeaking, setIsPresenterSpeaking] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [publicReaction, setPublicReaction] = useState("");
  const [closingMessage, setClosingMessage] = useState("");
  const [hasClosingPlaybackFinished, setHasClosingPlaybackFinished] =
    useState(false);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const pendingSubmissionRef = useRef<PendingSubmission | null>(null);

  useEffect(() => {
    try {
      const sourceIsLive = new URLSearchParams(window.location.search).get("source") === "live";
      if (sourceIsLive) {
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
        window.localStorage.removeItem(REPORT_STORAGE_KEY);
        const storedBrief = window.sessionStorage.getItem(
          CANDIDATE_BRIEF_STORAGE_KEY,
        );
        const parsedBrief = storedBrief
          ? CandidateBriefSchema.safeParse(JSON.parse(storedBrief))
          : null;
        if (parsedBrief?.success) {
          setCandidateBrief(parsedBrief.data);
          setRoleProfile(buildRoleProfile(parsedBrief.data.roleId));
        } else {
          setContextError("没有读取到已确认的真实材料，请返回准备页重新确认。 ");
        }
        window.history.replaceState(null, "", window.location.pathname);
      }

      const savedSession = window.localStorage.getItem(SESSION_STORAGE_KEY);
      const parsedSession = savedSession
        ? LiveInterviewSessionSchema.safeParse(JSON.parse(savedSession))
        : null;
      if (parsedSession?.success) {
        setSession(parsedSession.data);
        setCandidateBrief(parsedSession.data.candidateBrief);
        setRoleProfile(parsedSession.data.roleProfile);
      }

      const savedReport = window.localStorage.getItem(REPORT_STORAGE_KEY);
      const parsedReport = savedReport
        ? LiveCoachReportSchema.safeParse(JSON.parse(savedReport))
        : null;
      if (
        parsedReport?.success &&
        parsedSession?.success &&
        parsedReport.data.sessionId === parsedSession.data.id
      ) {
        setReport(parsedReport.data);
      }
    } catch {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
      window.localStorage.removeItem(REPORT_STORAGE_KEY);
    } finally {
      setHasRestored(true);
    }
  }, []);

  useEffect(() => {
    if (
      !session ||
      session.stages[session.currentStageIndex]?.id !== "algorithm_reasoning" ||
      !session.algorithmThinkingEndsAt ||
      session.algorithmThinkingCompletedAt ||
      session.turns.some((turn) => turn.stageId === "algorithm_reasoning")
    ) {
      return;
    }
    const thinkingEndsAt = new Date(session.algorithmThinkingEndsAt).getTime();
    setClockNow(Date.now());
    const interval = window.setInterval(() => {
      const now = Date.now();
      setClockNow(now);
      if (now >= thinkingEndsAt) window.clearInterval(interval);
    }, 1_000);
    return () => window.clearInterval(interval);
  }, [session]);

  function startInterview(mode: InterviewMode) {
    const nextSession = createLiveInterviewSession({
      id: createClientId("session"),
      mode,
      roleProfile,
      candidateBrief,
    });
    window.localStorage.removeItem(REPORT_STORAGE_KEY);
    persistSession(nextSession);
    setSession(nextSession);
    setReport(null);
    setIsPresenterSpeaking(false);
    setPublicReaction("");
    setClosingMessage("");
    setHasClosingPlaybackFinished(false);
    setRequestError("");
  }

  function resetInterview() {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    window.localStorage.removeItem(REPORT_STORAGE_KEY);
    setSession(null);
    setReport(null);
    setIsPresenterSpeaking(false);
    setPublicReaction("");
    setClosingMessage("");
    setHasClosingPlaybackFinished(false);
    setRequestError("");
  }

  function finishAlgorithmThinkingEarly() {
    if (!session || session.state !== "INTERVIEWING") return;
    const updated = LiveInterviewSessionSchema.parse({
      ...session,
      algorithmThinkingCompletedAt: new Date().toISOString(),
    });
    setSession(updated);
    persistSession(updated);
  }

  function startAlgorithmThinkingAfterPrompt() {
    if (
      !session ||
      session.state !== "INTERVIEWING" ||
      session.stages[session.currentStageIndex]?.id !== "algorithm_reasoning" ||
      session.algorithmThinkingEndsAt ||
      session.algorithmThinkingCompletedAt ||
      session.turns.some((turn) => turn.stageId === "algorithm_reasoning")
    ) {
      return;
    }
    const updated = LiveInterviewSessionSchema.parse({
      ...session,
      algorithmThinkingEndsAt: new Date(
        Date.now() + session.algorithmProblem.thinkingTimeSeconds * 1_000,
      ).toISOString(),
    });
    setClockNow(Date.now());
    setSession(updated);
    persistSession(updated);
  }

  async function requestCoachReport(completedSession: LiveSession) {
    setRequestError("");
    setIsGeneratingReport(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REPORT_TIMEOUT_MS);
    try {
      const response = await fetch("/api/interview/live/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session: completedSession,
          requestId: createClientId("report"),
        }),
        cache: "no-store",
        signal: controller.signal,
      });
      const payload = (await response.json().catch(() => ({}))) as ReportResponsePayload;
      if (!response.ok || payload.ok !== true) {
        throw new Error(payload.message || "复盘生成失败，面试记录已保存。 ");
      }
      const parsedReport = LiveCoachReportSchema.safeParse(payload.report);
      if (!parsedReport.success) throw new Error("复盘结果格式不完整，请重试。 ");

      const reviewedSession = LiveInterviewSessionSchema.parse({
        ...completedSession,
        state: "REVIEWED",
      });
      setSession(reviewedSession);
      setReport(parsedReport.data);
      persistSession(reviewedSession);
      window.localStorage.setItem(
        REPORT_STORAGE_KEY,
        JSON.stringify(parsedReport.data),
      );
    } catch (error) {
      setRequestError(
        error instanceof DOMException && error.name === "AbortError"
          ? "复盘生成超时，面试记录已保存在本机，可以直接重试。"
          : error instanceof Error
            ? error.message
            : "复盘生成失败，面试记录已保存，可以直接重试。",
      );
    } finally {
      clearTimeout(timeout);
      setIsGeneratingReport(false);
    }
  }

  async function submitConfirmedAnswer(answer: ConfirmedAnswer) {
    if (!session || session.state !== "INTERVIEWING") return;
    const signature = [
      session.turns.length + 1,
      session.currentQuestionText,
      answer.answerSource,
      answer.rawSttText ?? "",
      answer.confirmedAnswerText,
    ].join("\u0000");
    let pending = pendingSubmissionRef.current;
    if (!pending || pending.signature !== signature) {
      pending = { signature, requestId: createClientId("interview") };
      pendingSubmissionRef.current = pending;
    }

    setRequestError("");
    setIsThinking(true);
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      INTERVIEW_RESPONSE_TIMEOUT_MS,
    );

    try {
      const response = await fetch("/api/interview/live/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session,
          answerSource: answer.answerSource,
          rawSttText: answer.rawSttText,
          confirmedAnswerText: answer.confirmedAnswerText,
          requestId: pending.requestId,
        }),
        cache: "no-store",
        signal: controller.signal,
      });
      const payload = (await response.json().catch(() => ({}))) as InterviewResponsePayload;
      if (!response.ok || payload.ok !== true) {
        throw new Error(payload.message || "面试官暂时无法生成下一步，请重试。 ");
      }

      const parsedTurn = LiveInterviewTurnSchema.safeParse(payload.turn);
      const nextStageIndex = payload.nextStageIndex;
      const finished = payload.interviewFinished === true;
      const nextQuestionText = payload.nextQuestionText?.trim() || null;
      if (
        !parsedTurn.success ||
        typeof nextStageIndex !== "number" ||
        nextStageIndex < 0 ||
        nextStageIndex >= session.stages.length ||
        (!finished && !nextQuestionText)
      ) {
        throw new Error("面试官返回了不完整的轮次，请重试本轮。 ");
      }

      const enteringAlgorithm =
        session.stages[session.currentStageIndex]?.id !== "algorithm_reasoning" &&
        session.stages[nextStageIndex]?.id === "algorithm_reasoning";
      const updatedSession = LiveInterviewSessionSchema.parse({
        ...session,
        state: finished ? "ANALYZING" : "INTERVIEWING",
        currentStageIndex: nextStageIndex,
        currentQuestionText: nextQuestionText ?? session.currentQuestionText,
        turns: [...session.turns, parsedTurn.data],
        algorithmThinkingEndsAt: enteringAlgorithm
          ? null
          : session.algorithmThinkingEndsAt,
        algorithmThinkingCompletedAt: enteringAlgorithm
          ? null
          : session.algorithmThinkingCompletedAt,
        completedAt: finished ? new Date().toISOString() : null,
      });
      pendingSubmissionRef.current = null;
      setSession(updatedSession);
      setPublicReaction(payload.publicReaction?.trim() || "");
      setClosingMessage(payload.closingMessage?.trim() || "");
      persistSession(updatedSession);
      if (finished) setHasClosingPlaybackFinished(false);
    } catch (error) {
      const message =
        error instanceof DOMException && error.name === "AbortError"
          ? "面试官响应超时；回答文字已经保留，请直接重试提交。"
          : error instanceof Error
            ? error.message
            : "提交失败；回答文字已经保留，请重试。";
      setRequestError(message);
      throw error;
    } finally {
      clearTimeout(timeout);
      setIsThinking(false);
    }
  }

  if (!hasRestored) {
    return <p className="success-note">正在恢复本机面试记录…</p>;
  }

  if (contextError) {
    return (
      <section className="mode-select" role="alert">
        <p className="eyebrow">材料尚未就绪</p>
        <h1>无法开始真实材料面试</h1>
        <p>{contextError}</p>
        <Link className="button button-primary" href="/prepare">
          返回准备材料 <span>→</span>
        </Link>
      </section>
    );
  }

  if (!session) {
    return (
      <section className="mode-select" aria-labelledby="mode-select-title">
        <p className="eyebrow">开始面试</p>
        <h1 id="mode-select-title">选择本场面试强度</h1>
        <p>
          两种模式都完整走完六个阶段；区别只在追问深度与时长。全程连续进行，结束后统一复盘。
        </p>
        <p className="mode-context">
          本场材料：{candidateBrief.displayName} · {candidateBrief.job.title}
        </p>
        <div className="mode-grid">
          {(["quick", "realistic"] as const).map((mode) => {
            const copy = INTERVIEW_MODE_COPY[mode];
            return (
              <button
                className="mode-card"
                key={mode}
                onClick={() => startInterview(mode)}
                type="button"
              >
                <strong>{copy.label}</strong>
                <p>{copy.description}</p>
                <small>{copy.duration}</small>
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  const currentStage = session.stages[session.currentStageIndex];
  const finished = session.state === "ANALYZING" || session.state === "REVIEWED";
  const algorithmStageHasAnswer = session.turns.some(
    (turn) => turn.stageId === "algorithm_reasoning",
  );
  const algorithmThinkingRemaining = session.algorithmThinkingEndsAt
    ? Math.max(
        0,
        Math.ceil(
          (new Date(session.algorithmThinkingEndsAt).getTime() - clockNow) / 1_000,
        ),
      )
    : 0;
  const algorithmPromptPlaybackPending =
    currentStage.id === "algorithm_reasoning" &&
    !algorithmStageHasAnswer &&
    !session.algorithmThinkingCompletedAt &&
    !session.algorithmThinkingEndsAt;
  const algorithmThinkingActive =
    currentStage.id === "algorithm_reasoning" &&
    !algorithmStageHasAnswer &&
    !session.algorithmThinkingCompletedAt &&
    algorithmThinkingRemaining > 0;

  function finishClosingPlayback() {
    if (
      !session ||
      hasClosingPlaybackFinished ||
      session.state !== "ANALYZING" ||
      report
    ) {
      return;
    }
    setHasClosingPlaybackFinished(true);
    void requestCoachReport(session);
  }

  return (
    <>
      <div className="interview-topline">
        <div
          className="session-progress"
          aria-label={`当前第 ${session.currentStageIndex + 1} 阶段，共 ${session.stages.length} 阶段`}
        >
          {session.stages.map((stage, index) => (
            <i
              className={
                index < session.currentStageIndex || finished
                  ? "is-complete"
                  : index === session.currentStageIndex
                    ? "is-current"
                    : undefined
              }
              key={stage.id}
              title={`${stage.order}. ${stage.title}`}
            />
          ))}
        </div>
        <span>
          {INTERVIEW_MODE_COPY[session.mode].label} · 第{" "}
          {session.currentStageIndex + 1} / 6 阶段 · 已回答 {session.turns.length} 轮
        </span>
      </div>

      {!report && (
        <div className="interview-layout">
          <PresenterCard
            state={
              finished
                ? "idle"
                : isThinking
                  ? "thinking"
                  : isPresenterSpeaking
                    ? publicReaction
                      ? "followup"
                      : "speaking"
                    : "listening"
            }
          />
          <div className="interview-main">
            <section className="question-card">
              <div className="question-kicker">
                <span>{finished ? "面试已结束" : currentStage.title}</span>
                <span>
                  {finished
                    ? `${session.turns.length} 轮确认回答已保存`
                    : `阶段 ${currentStage.order} · 自动判断追问深度`}
                </span>
              </div>
              <h1>
                {finished
                  ? closingMessage || "本场面试已结束，正在生成整场复盘。"
                  : session.currentQuestionText}
              </h1>
              <div className="source-reference">
                <span>{publicReaction ? "面试官回应" : "本阶段目标"}</span>
                {publicReaction || currentStage.purpose}
              </div>
            </section>

            {!finished && currentStage.id === "algorithm_reasoning" && !algorithmStageHasAnswer && (
              <section className="algorithm-thinking-card" aria-live="polite">
                <div>
                  <span>{session.algorithmProblem.sourceLabel}</span>
                  <strong>{session.algorithmProblem.title}</strong>
                  <small>
                    {DIFFICULTY_LABELS[session.algorithmProblem.difficulty]} · 建议思考{" "}
                    {session.algorithmProblem.thinkingTimeSeconds / 60} 分钟
                  </small>
                </div>
                <div className="algorithm-countdown">
                  <span>
                    {algorithmPromptPlaybackPending
                      ? "面试官正在读题"
                      : algorithmThinkingActive
                        ? "独立思考中"
                        : "可以开始讲解"}
                  </span>
                  <strong>
                    {formatCountdown(
                      algorithmPromptPlaybackPending
                        ? session.algorithmProblem.thinkingTimeSeconds
                        : algorithmThinkingRemaining,
                    )}
                  </strong>
                </div>
                {algorithmThinkingActive && (
                  <button
                    className="button button-secondary"
                    onClick={finishAlgorithmThinkingEarly}
                    type="button"
                  >
                    提前结束思考，开始讲解
                  </button>
                )}
              </section>
            )}

            {!finished && (
              <VoiceRecorder
                answerEnabled={
                  !algorithmPromptPlaybackPending && !algorithmThinkingActive
                }
                initialTranscript=""
                key={`${session.turns.length}:${session.currentQuestionText}`}
                onConfirm={submitConfirmedAnswer}
                onQuestionPlaybackEnded={
                  algorithmPromptPlaybackPending
                    ? startAlgorithmThinkingAfterPrompt
                    : undefined
                }
                onQuestionPlaybackStateChange={setIsPresenterSpeaking}
                question={session.currentQuestionText}
              />
            )}

            {requestError && (
              <p className="inline-error" role="alert">
                {requestError}
              </p>
            )}

            {finished && (
              <section className="analysis-card" aria-live="polite">
                <strong>
                  {isGeneratingReport ? "Coach 正在复盘整场证据…" : "面试记录已保存"}
                </strong>
                <p>
                  对话已保存在当前浏览器。复盘失败不会影响 Transcript，可以随时重试。
                </p>
                <ElapsedWait
                  active={isGeneratingReport}
                  compact
                  label="Coach 正在汇总六阶段证据并生成复盘"
                  timeoutSeconds={REPORT_TIMEOUT_MS / 1_000}
                />
                {hasClosingPlaybackFinished && !isGeneratingReport && !report && (
                  <button
                    className="button button-primary"
                    onClick={() => void requestCoachReport(session)}
                    type="button"
                  >
                    重新生成复盘 <span>→</span>
                  </button>
                )}
              </section>
            )}

            {finished && (
              <VoiceRecorder
                answerEnabled={false}
                initialTranscript=""
                key={`closing:${closingMessage}`}
                onQuestionPlaybackEnded={finishClosingPlayback}
                question={
                  closingMessage || "本场面试已结束，请留意后续通知。"
                }
                speakerOnly
              />
            )}

            <details className="transcript-log">
              <summary>查看已保存对话 · {session.turns.length} 轮</summary>
              {session.turns.map((turn) => (
                <article key={turn.id}>
                  <b>面试官：{turn.questionText}</b>
                  <p>你：{turn.confirmedAnswerText}</p>
                </article>
              ))}
            </details>
          </div>
        </div>
      )}

      {report && <InterviewCompletion report={report} />}

      <div className="session-reset">
        <button className="button button-ghost" onClick={resetInterview} type="button">
          开始一场新面试
        </button>
      </div>
    </>
  );
}
