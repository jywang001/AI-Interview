import { describe, expect, it } from "vitest";
import { demoCandidateBrief } from "@/fixtures/demo-session";
import {
  buildLiveStages,
  buildRoleProfile,
  createLiveInterviewSession,
} from "@/lib/interview/live-stages";
import { LIVE_STAGE_IDS } from "@/lib/interview/live-schemas";
import { selectHot100Problem } from "@/lib/interview/hot100";

describe("six-stage live interview contract", () => {
  it("locks the six stages in product order", () => {
    const stages = buildLiveStages("ai_application", "quick");

    expect(stages.map((stage) => stage.id)).toEqual(LIVE_STAGE_IDS);
    expect(stages.map((stage) => stage.order)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("gives realistic mode a larger probe and time budget", () => {
    const quick = buildLiveStages("ai_application", "quick");
    const realistic = buildLiveStages("ai_application", "realistic");

    quick.forEach((stage, index) => {
      expect(realistic[index].maxFollowUps).toBeGreaterThanOrEqual(
        stage.maxFollowUps,
      );
      expect(realistic[index].timeBudgetSeconds).toBeGreaterThanOrEqual(
        stage.timeBudgetSeconds,
      );
    });
  });

  it("creates a schema-valid session with a role-specific opening", () => {
    const session = createLiveInterviewSession({
      id: "schema-valid-session",
      mode: "quick",
      roleProfile: buildRoleProfile("ai_application"),
      candidateBrief: demoCandidateBrief,
    });

    expect(session.currentQuestionText).toContain("AI 应用开发岗");
    expect(session.stages).toHaveLength(6);
    expect(session.state).toBe("INTERVIEWING");
  });

  it("selects Hot 100 questions deterministically for a session", () => {
    const input = {
      sessionId: "stable-session",
      mode: "realistic" as const,
      roleId: "ai_algorithm" as const,
    };

    expect(selectHot100Problem(input)).toEqual(selectHot100Problem(input));
  });

  it("keeps quick and application interviews away from hard questions", () => {
    for (let index = 0; index < 30; index += 1) {
      expect(
        selectHot100Problem({
          sessionId: `quick-${index}`,
          mode: "quick",
          roleId: "ai_algorithm",
        }).difficulty,
      ).not.toBe("hard");
      expect(
        selectHot100Problem({
          sessionId: `application-${index}`,
          mode: "realistic",
          roleId: "ai_application",
        }).difficulty,
      ).not.toBe("hard");
    }
  });
});
