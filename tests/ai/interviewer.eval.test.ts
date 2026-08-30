import { beforeAll, describe, expect, it } from "vitest";
import { generateLiveCoachReport } from "@/lib/interview/live-report.server";
import { respondToLiveInterview } from "@/lib/interview/live-respond.server";
import type {
  LiveInterviewSession,
  LiveInterviewTurn,
} from "@/lib/interview/live-schemas";
import {
  createSessionAtStage,
  makeAssessment,
} from "../helpers/live-session";

function loadLocalEnvironment() {
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL) return;
  try {
    process.loadEnvFile(".env");
  } catch {
    // The explicit precondition below provides the actionable error message.
  }
}

function requireModelConfiguration() {
  loadLocalEnvironment();
  if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL) {
    throw new Error(
      "AI evals require OPENAI_API_KEY and OPENAI_MODEL in the environment or local .env.",
    );
  }
}

function completedSessionForCoach(): LiveInterviewSession {
  const base = createSessionAtStage(5, "quick");
  const timestamp = new Date().toISOString();
  const answers: Record<string, string> = {
    self_intro:
      "我是应届生，主要做 AI 应用开发。我在知识助手项目中负责 RAG 服务、离线评估和超时降级，希望应聘 AI 应用开发岗位。",
    resume_deep_dive:
      "我个人负责检索 API、重排和生成链路，把三个阶段分别记录耗时，并在生成超时时返回带引用的检索摘要。",
    role_knowledge:
      "我会先检查召回片段里是否包含正确证据；没有证据是检索问题，有证据却答错才继续检查生成过程。",
    algorithm_reasoning:
      "我会先按区间左端点排序，维护当前合并区间。下一个左端点不大于当前右端点时更新右端点为两者最大值，否则保存当前区间并开始新区间，最后补上当前区间。",
    motivation_availability:
      "我希望把模型能力做成可靠产品，这与我的 RAG 和服务降级经历匹配。我九月可以到岗，能够连续实习六个月。",
    candidate_questions:
      "我想了解团队目前如何评估 RAG 系统，以及新人最先负责哪类工作。",
  };

  const turns: LiveInterviewTurn[] = base.stages.map((stage, index) => {
    const answer = answers[stage.id];
    return {
      id: `coach-eval-turn-${index + 1}`,
      index: index + 1,
      stageId: stage.id,
      stageTurnIndex: 1,
      questionText:
        index === base.currentStageIndex
          ? base.currentQuestionText
          : `测试问题：${stage.title}`,
      answerSource: "text",
      rawSttText: null,
      confirmedAnswerText: answer,
      assessment: {
        directness: "sufficient",
        slotUpdates: makeAssessment(
          { ...base, currentStageIndex: index },
          Object.fromEntries(stage.slots.map((slot) => [slot.id, "covered"])),
        ).slotUpdates.map((update) => ({
          ...update,
          evidenceQuote: answer.slice(0, Math.min(20, answer.length)),
        })),
        criticalMissingSlotIds: [],
        probeValue: "low",
        probeKind: null,
        decisionSummary: "测试回答包含主要证据。",
        followUpAnchor: null,
      },
      decision: index === base.stages.length - 1 ? "finish" : "advance",
      createdAt: timestamp,
      submittedAt: timestamp,
    };
  });

  return {
    ...base,
    state: "ANALYZING",
    turns,
    completedAt: timestamp,
  };
}

describe.sequential("live-model interview behavior evals", () => {
  beforeAll(requireModelConfiguration);

  it("anchors an incomplete resume answer instead of asking a generic question", async () => {
    const session = createSessionAtStage(1, "realistic");
    const answer =
      "我负责了 RAG 服务里的混合检索，并把召回、重排和生成分开记录错误。";
    const result = await respondToLiveInterview({
      session,
      answerSource: "text",
      rawSttText: null,
      confirmedAnswerText: answer,
      requestId: "eval-resume-followup",
    });

    expect(result.decision).toBe("probe");
    expect(result.nextQuestionText).toBeTruthy();
    expect(result.nextQuestionText).not.toMatch(/详细说说|展开讲讲|再具体一点/);
    if (result.turn.assessment.probeKind === "deepen") {
      expect(result.turn.assessment.followUpAnchor).toBeTruthy();
      expect(answer).toContain(result.turn.assessment.followUpAnchor ?? "");
    }
  }, 50_000);

  it("records an unknown knowledge answer and switches instead of badgering", async () => {
    const session = createSessionAtStage(2, "quick");
    const result = await respondToLiveInterview({
      session,
      answerSource: "text",
      rawSttText: null,
      confirmedAnswerText: "这个知识点我目前不知道，没办法给出可靠解释。",
      requestId: "eval-knowledge-stop-loss",
    });

    expect(
      result.decision === "advance" ||
        (result.decision === "probe" &&
          result.turn.assessment.probeKind === "pivot"),
    ).toBe(true);
  }, 50_000);

  it("makes every Coach quote traceable to a confirmed answer", async () => {
    const session = completedSessionForCoach();
    const report = await generateLiveCoachReport(session);
    const turns = new Map(session.turns.map((turn) => [turn.id, turn]));

    expect(report.stageReports).toHaveLength(6);
    for (const stage of report.stageReports) {
      expect(stage.evidence.length).toBeGreaterThan(0);
      for (const evidence of stage.evidence) {
        const turn = turns.get(evidence.turnId);
        expect(turn?.stageId).toBe(stage.stageId);
        expect(turn?.confirmedAnswerText).toContain(evidence.quote);
      }
    }
  }, 65_000);
});
