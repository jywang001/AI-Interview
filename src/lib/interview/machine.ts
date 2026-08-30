import {
  P0_OBJECTIVE_COUNT,
  P0_TURN_BUDGET,
  SESSION_STATES,
  type InterviewSession,
  type SessionState,
} from "./schemas";

export const SESSION_TRANSITIONS: Readonly<
  Record<SessionState, readonly SessionState[]>
> = {
  DRAFT: ["MATERIAL_REVIEW"],
  MATERIAL_REVIEW: ["PLAN_READY"],
  PLAN_READY: ["INTERVIEWING"],
  INTERVIEWING: ["ANALYZING"],
  ANALYZING: ["REVIEWED"],
  REVIEWED: ["RETRAINING"],
  RETRAINING: ["COMPLETED"],
  COMPLETED: [],
};

export type InterviewMachineSnapshot = {
  state: SessionState;
  materialsConfirmed: boolean;
  objectiveCount: number;
  turnCount: number;
  reportReady: boolean;
  drillAttemptCount: number;
};

export type InterviewMachineEvent =
  | { type: "BEGIN_MATERIAL_REVIEW" }
  | {
      type: "CONFIRM_MATERIALS_AND_PLAN";
      objectiveCount: typeof P0_OBJECTIVE_COUNT;
    }
  | { type: "START_INTERVIEW" }
  | {
      type: "FINISH_INTERVIEW";
      turnCount: typeof P0_TURN_BUDGET;
    }
  | { type: "PUBLISH_REPORT" }
  | { type: "START_DRILL" }
  | { type: "COMPLETE_DRILL"; drillAttemptCount: number };

export type TransitionValidation =
  | { ok: true; from: SessionState; to: SessionState }
  | { ok: false; from: SessionState; to: SessionState; reasons: string[] };

const EVENT_TARGETS: Readonly<
  Record<InterviewMachineEvent["type"], SessionState>
> = {
  BEGIN_MATERIAL_REVIEW: "MATERIAL_REVIEW",
  CONFIRM_MATERIALS_AND_PLAN: "PLAN_READY",
  START_INTERVIEW: "INTERVIEWING",
  FINISH_INTERVIEW: "ANALYZING",
  PUBLISH_REPORT: "REVIEWED",
  START_DRILL: "RETRAINING",
  COMPLETE_DRILL: "COMPLETED",
};

const STATE_LABELS: Readonly<Record<SessionState, string>> = {
  DRAFT: "创建训练",
  MATERIAL_REVIEW: "确认材料",
  PLAN_READY: "确认计划",
  INTERVIEWING: "模拟面试",
  ANALYZING: "生成复盘",
  REVIEWED: "查看复盘",
  RETRAINING: "定向重练",
  COMPLETED: "训练完成",
};

export class IllegalInterviewTransitionError extends Error {
  readonly from: SessionState;
  readonly to: SessionState;
  readonly reasons: readonly string[];

  constructor(validation: Extract<TransitionValidation, { ok: false }>) {
    super(
      `Illegal interview transition ${validation.from} → ${validation.to}: ${validation.reasons.join(" ")}`,
    );
    this.name = "IllegalInterviewTransitionError";
    this.from = validation.from;
    this.to = validation.to;
    this.reasons = validation.reasons;
  }
}

export function isSessionState(value: unknown): value is SessionState {
  return (
    typeof value === "string" &&
    (SESSION_STATES as readonly string[]).includes(value)
  );
}

export function getAllowedNextStates(
  state: SessionState,
): readonly SessionState[] {
  return SESSION_TRANSITIONS[state];
}

export function isLegalStateEdge(
  from: SessionState,
  to: SessionState,
): boolean {
  return SESSION_TRANSITIONS[from].includes(to);
}

export function validateTransition(
  snapshot: InterviewMachineSnapshot,
  to: SessionState,
): TransitionValidation {
  const from = snapshot.state;
  const reasons: string[] = [];

  if (!isLegalStateEdge(from, to)) {
    reasons.push(`${from} cannot transition directly to ${to}.`);
  }

  if (from === "MATERIAL_REVIEW" && to === "PLAN_READY") {
    if (!snapshot.materialsConfirmed) {
      reasons.push("Materials must be confirmed before the plan is ready.");
    }
    if (snapshot.objectiveCount !== P0_OBJECTIVE_COUNT) {
      reasons.push(`P0 requires exactly ${P0_OBJECTIVE_COUNT} objectives.`);
    }
  }

  if (from === "PLAN_READY" && to === "INTERVIEWING") {
    if (!snapshot.materialsConfirmed) {
      reasons.push("Interview cannot start with unconfirmed materials.");
    }
    if (snapshot.objectiveCount !== P0_OBJECTIVE_COUNT) {
      reasons.push(`Interview plan must contain ${P0_OBJECTIVE_COUNT} objectives.`);
    }
  }

  if (from === "INTERVIEWING" && to === "ANALYZING") {
    if (snapshot.turnCount !== P0_TURN_BUDGET) {
      reasons.push(`P0 analysis requires exactly ${P0_TURN_BUDGET} turns.`);
    }
  }

  if (from === "ANALYZING" && to === "REVIEWED" && !snapshot.reportReady) {
    reasons.push("A validated Coach report is required before review.");
  }

  if (
    from === "RETRAINING" &&
    to === "COMPLETED" &&
    snapshot.drillAttemptCount < 1
  ) {
    reasons.push("At least one drill attempt is required to complete training.");
  }

  return reasons.length === 0
    ? { ok: true, from, to }
    : { ok: false, from, to, reasons };
}

export function assertLegalTransition(
  snapshot: InterviewMachineSnapshot,
  to: SessionState,
): void {
  const validation = validateTransition(snapshot, to);
  if (!validation.ok) {
    throw new IllegalInterviewTransitionError(validation);
  }
}

function applyEventFacts(
  snapshot: InterviewMachineSnapshot,
  event: InterviewMachineEvent,
): InterviewMachineSnapshot {
  switch (event.type) {
    case "BEGIN_MATERIAL_REVIEW":
    case "START_INTERVIEW":
    case "START_DRILL":
      return snapshot;
    case "CONFIRM_MATERIALS_AND_PLAN":
      return {
        ...snapshot,
        materialsConfirmed: true,
        objectiveCount: event.objectiveCount,
      };
    case "FINISH_INTERVIEW":
      return { ...snapshot, turnCount: event.turnCount };
    case "PUBLISH_REPORT":
      return { ...snapshot, reportReady: true };
    case "COMPLETE_DRILL":
      return { ...snapshot, drillAttemptCount: event.drillAttemptCount };
  }
}

export function transitionInterviewMachine(
  snapshot: InterviewMachineSnapshot,
  event: InterviewMachineEvent,
): InterviewMachineSnapshot {
  const expectedTarget = EVENT_TARGETS[event.type];
  const withEventFacts = applyEventFacts(snapshot, event);
  const validation = validateTransition(withEventFacts, expectedTarget);

  if (!validation.ok) {
    throw new IllegalInterviewTransitionError(validation);
  }

  return { ...withEventFacts, state: expectedTarget };
}

export function snapshotFromSession(
  session: InterviewSession,
  options: { reportReady?: boolean; drillAttemptCount?: number } = {},
): InterviewMachineSnapshot {
  return {
    state: session.state,
    materialsConfirmed: Boolean(session.candidateBrief.confirmedAt),
    objectiveCount: session.objectives.length,
    turnCount: session.turns.length,
    reportReady: options.reportReady ?? false,
    drillAttemptCount: options.drillAttemptCount ?? 0,
  };
}

export function createDemoMachineSnapshot(
  state: SessionState = "DRAFT",
): InterviewMachineSnapshot {
  const stateIndex = SESSION_STATES.indexOf(state);
  const hasPlan = stateIndex >= SESSION_STATES.indexOf("PLAN_READY");
  const hasTranscript = stateIndex >= SESSION_STATES.indexOf("ANALYZING");
  const hasReport = stateIndex >= SESSION_STATES.indexOf("REVIEWED");
  const hasDrill = stateIndex >= SESSION_STATES.indexOf("COMPLETED");

  return {
    state,
    materialsConfirmed: hasPlan,
    objectiveCount: hasPlan ? P0_OBJECTIVE_COUNT : 0,
    turnCount: hasTranscript ? P0_TURN_BUDGET : 0,
    reportReady: hasReport,
    drillAttemptCount: hasDrill ? 1 : 0,
  };
}

export function advanceDemoMachine(
  snapshot: InterviewMachineSnapshot,
): InterviewMachineSnapshot {
  switch (snapshot.state) {
    case "DRAFT":
      return transitionInterviewMachine(snapshot, {
        type: "BEGIN_MATERIAL_REVIEW",
      });
    case "MATERIAL_REVIEW":
      return transitionInterviewMachine(snapshot, {
        type: "CONFIRM_MATERIALS_AND_PLAN",
        objectiveCount: P0_OBJECTIVE_COUNT,
      });
    case "PLAN_READY":
      return transitionInterviewMachine(snapshot, { type: "START_INTERVIEW" });
    case "INTERVIEWING":
      return transitionInterviewMachine(snapshot, {
        type: "FINISH_INTERVIEW",
        turnCount: P0_TURN_BUDGET,
      });
    case "ANALYZING":
      return transitionInterviewMachine(snapshot, { type: "PUBLISH_REPORT" });
    case "REVIEWED":
      return transitionInterviewMachine(snapshot, { type: "START_DRILL" });
    case "RETRAINING":
      return transitionInterviewMachine(snapshot, {
        type: "COMPLETE_DRILL",
        drillAttemptCount: Math.max(snapshot.drillAttemptCount, 1),
      });
    case "COMPLETED":
      return snapshot;
  }
}

export function getDemoProgress(state: SessionState): {
  index: number;
  total: number;
  percent: number;
  label: string;
  isComplete: boolean;
} {
  const index = SESSION_STATES.indexOf(state);
  const finalIndex = SESSION_STATES.length - 1;

  return {
    index,
    total: SESSION_STATES.length,
    percent: Math.round((index / finalIndex) * 100),
    label: STATE_LABELS[state],
    isComplete: state === "COMPLETED",
  };
}
