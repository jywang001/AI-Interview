import { demoCandidateBrief } from "@/fixtures/demo-session";
import type {
  LiveInterviewSession,
  LiveInterviewTurn,
} from "@/lib/interview/live-schemas";
import type { LiveDecisionAssessment } from "@/lib/interview/live-decision";
import {
  buildRoleProfile,
  createLiveInterviewSession,
  openingQuestionForStage,
} from "@/lib/interview/live-stages";

export function createSessionAtStage(
  stageIndex: number,
  mode: "quick" | "realistic" = "quick",
): LiveInterviewSession {
  const base = createLiveInterviewSession({
    id: `test-session-${stageIndex}-${mode}`,
    mode,
    roleProfile: buildRoleProfile(demoCandidateBrief.roleId),
    candidateBrief: demoCandidateBrief,
  });
  const stage = base.stages[stageIndex];
  return {
    ...base,
    currentStageIndex: stageIndex,
    currentQuestionText: openingQuestionForStage(stage.id, base),
  };
}

export function makeAssessment(
  session: LiveInterviewSession,
  statuses: Partial<
    Record<
      string,
      "missing" | "partial" | "covered" | "contradicted"
    >
  >,
  options: Partial<
    Pick<
      LiveDecisionAssessment,
      "directness" | "probeValue" | "probeKind" | "followUpQuestion"
    >
  > = {},
): LiveDecisionAssessment {
  const stage = session.stages[session.currentStageIndex];
  return {
    directness: options.directness ?? "partial",
    probeValue: options.probeValue ?? "high",
    probeKind: options.probeKind ?? "deepen",
    followUpQuestion:
      options.followUpQuestion === undefined
        ? "请针对这个关键缺口再说明一次。"
        : options.followUpQuestion,
    slotUpdates: stage.slots.map((slot) => {
      const status = statuses[slot.id] ?? "missing";
      return {
        slotId: slot.id,
        status,
        evidenceQuote: status === "missing" ? null : `evidence-${slot.id}`,
        rationale: `test-${status}`,
      };
    }),
  };
}

export function appendStageTurn(
  session: LiveInterviewSession,
  probeKind: "deepen" | "pivot" | null,
): LiveInterviewSession {
  const stage = session.stages[session.currentStageIndex];
  const timestamp = new Date().toISOString();
  const turn: LiveInterviewTurn = {
    id: `test-turn-${session.turns.length + 1}`,
    index: session.turns.length + 1,
    stageId: stage.id,
    stageTurnIndex:
      session.turns.filter((item) => item.stageId === stage.id).length + 1,
    questionText: session.currentQuestionText,
    answerSource: "text",
    rawSttText: null,
    confirmedAnswerText: "这是用于测试控制策略的确认版回答。",
    assessment: {
      directness: "partial",
      slotUpdates: stage.slots.map((slot) => ({
        slotId: slot.id,
        status: "missing",
        evidenceQuote: null,
        rationale: "test-missing",
      })),
      criticalMissingSlotIds: stage.slots
        .filter((slot) => slot.priority === "must")
        .map((slot) => slot.id),
      probeValue: "high",
      probeKind,
      decisionSummary: "测试历史轮次。",
      followUpAnchor: null,
    },
    decision: probeKind ? "probe" : "advance",
    createdAt: timestamp,
    submittedAt: timestamp,
  };
  return { ...session, turns: [...session.turns, turn] };
}
