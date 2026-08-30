import { describe, expect, it } from "vitest";
import { decideLiveInterviewTurn } from "@/lib/interview/live-decision";
import {
  appendStageTurn,
  createSessionAtStage,
  makeAssessment,
} from "../helpers/live-session";

describe("live interview deterministic controller", () => {
  it("advances a quick stage as soon as every must-have slot is covered", () => {
    const session = createSessionAtStage(0, "quick");
    const assessment = makeAssessment(session, {
      current_background: "covered",
      target_direction: "covered",
      relevant_highlight: "missing",
    });

    expect(decideLiveInterviewTurn(session, assessment)).toEqual({
      decision: "advance",
      probeKind: null,
      nextQuestionOverride: null,
    });
  });

  it("keeps probing in realistic mode when a high-value should slot is missing", () => {
    const session = createSessionAtStage(0, "realistic");
    const assessment = makeAssessment(session, {
      current_background: "covered",
      target_direction: "covered",
      relevant_highlight: "missing",
    });

    expect(decideLiveInterviewTurn(session, assessment).decision).toBe("probe");
  });

  it("pivots away after one consecutive resume deepening", () => {
    const initial = createSessionAtStage(1, "realistic");
    const session = appendStageTurn(initial, "deepen");
    const assessment = makeAssessment(session, {}, { probeKind: "deepen" });
    const decision = decideLiveInterviewTurn(session, assessment);

    expect(decision.decision).toBe("probe");
    expect(decision.probeKind).toBe("pivot");
    expect(decision.nextQuestionOverride).toMatch(/换到|换一个角度/);
  });

  it("moves to another knowledge topic when the current answer has low probe value", () => {
    const session = createSessionAtStage(2, "quick");
    const assessment = makeAssessment(session, {}, {
      directness: "off_topic",
      probeValue: "low",
      probeKind: null,
      followUpQuestion: null,
    });
    const decision = decideLiveInterviewTurn(session, assessment);

    expect(decision.decision).toBe("probe");
    expect(decision.probeKind).toBe("pivot");
    expect(decision.nextQuestionOverride).toBeTruthy();
  });

  it("finishes after a sufficient final-stage answer", () => {
    const session = createSessionAtStage(5, "quick");
    const assessment = makeAssessment(session, {
      question_or_none: "covered",
    });

    expect(decideLiveInterviewTurn(session, assessment).decision).toBe("finish");
  });

  it("enforces the follow-up budget even when the model asks to continue", () => {
    const initial = createSessionAtStage(1, "quick");
    const once = appendStageTurn(initial, "deepen");
    const session = appendStageTurn(once, "pivot");
    const assessment = makeAssessment(session, {}, { probeKind: "deepen" });

    expect(decideLiveInterviewTurn(session, assessment).decision).toBe("advance");
  });
});
