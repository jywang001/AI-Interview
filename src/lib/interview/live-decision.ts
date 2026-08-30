import type {
  LiveInterviewSession,
  LiveInterviewTurn,
} from "@/lib/interview/live-schemas";
import { pivotResumeQuestion } from "@/lib/interview/resume-focus";
import { selectRoleKnowledgeTopics } from "@/lib/interview/role-knowledge";

type ProbeKind = NonNullable<LiveInterviewTurn["assessment"]["probeKind"]>;

export type LiveDecisionAssessment = Readonly<
  Pick<
    LiveInterviewTurn["assessment"],
    "directness" | "slotUpdates" | "probeValue" | "probeKind"
  > & {
    followUpQuestion: string | null;
  }
>;

export type LiveDecisionPlan = Readonly<{
  decision: "probe" | "advance" | "finish";
  probeKind: ProbeKind | null;
  nextQuestionOverride: string | null;
}>;

function cumulativeStatuses(
  session: LiveInterviewSession,
  assessment: LiveDecisionAssessment,
) {
  const stage = session.stages[session.currentStageIndex];
  const statuses = new Map<
    string,
    "missing" | "partial" | "covered" | "contradicted"
  >(stage.slots.map((slot) => [slot.id, "missing"]));
  const updates = [
    ...session.turns
      .filter((turn) => turn.stageId === stage.id)
      .flatMap((turn) => turn.assessment.slotUpdates),
    ...assessment.slotUpdates,
  ];

  for (const update of updates) {
    const previous = statuses.get(update.slotId);
    if (update.status === "contradicted") {
      statuses.set(update.slotId, "contradicted");
    } else if (update.status === "covered") {
      statuses.set(update.slotId, "covered");
    } else if (update.status === "partial" && previous === "missing") {
      statuses.set(update.slotId, "partial");
    }
  }

  return statuses;
}

/**
 * Deterministic control policy for a model-generated turn assessment.
 * The model interprets the answer; this function owns pacing, probe budgets,
 * anti-loop behavior, stage changes and the final stop decision.
 */
export function decideLiveInterviewTurn(
  session: LiveInterviewSession,
  assessment: LiveDecisionAssessment,
): LiveDecisionPlan {
  const stage = session.stages[session.currentStageIndex];
  const statuses = cumulativeStatuses(session, assessment);
  const mustCovered = stage.slots
    .filter((slot) => slot.priority === "must")
    .every((slot) => statuses.get(slot.id) === "covered");
  const shouldSlots = stage.slots.filter((slot) => slot.priority === "should");
  const shouldCovered = shouldSlots.filter(
    (slot) => statuses.get(slot.id) === "covered",
  ).length;
  const sufficient =
    mustCovered &&
    (session.mode === "quick" ||
      shouldSlots.length === 0 ||
      shouldCovered >= Math.ceil(shouldSlots.length / 2));
  const priorStageTurns = session.turns.filter(
    (turn) => turn.stageId === stage.id,
  ).length;
  const followUpsUsed = Math.max(0, priorStageTurns);
  let canProbe =
    followUpsUsed < stage.maxFollowUps &&
    assessment.probeValue === "high" &&
    assessment.followUpQuestion !== null &&
    session.turns.length < 39;

  if (stage.id === "role_knowledge") {
    const targetTopicCount = session.mode === "quick" ? 2 : 3;
    const topics = selectRoleKnowledgeTopics(
      session.candidateBrief,
      targetTopicCount,
    );
    const stageTurns = session.turns.filter(
      (turn) => turn.stageId === "role_knowledge",
    );
    const currentTopicIndex = Math.min(
      stageTurns.filter((turn) => turn.assessment.probeKind === "pivot").length,
      topics.length - 1,
    );
    const lastProbeKind = stageTurns.at(-1)?.assessment.probeKind ?? null;
    const nextTopic = topics[currentTopicIndex + 1];
    const remainingPivots = Math.max(0, topics.length - currentTopicIndex - 1);
    const remainingFollowUps = Math.max(
      0,
      stage.maxFollowUps - followUpsUsed,
    );
    const canAskAnother = remainingFollowUps > 0 && session.turns.length < 39;

    if (!canAskAnother) {
      return { decision: "advance", probeKind: null, nextQuestionOverride: null };
    }

    if (lastProbeKind === "deepen") {
      return nextTopic
        ? {
            decision: "probe",
            probeKind: "pivot",
            nextQuestionOverride: nextTopic.question,
          }
        : { decision: "advance", probeKind: null, nextQuestionOverride: null };
    }

    const worthOneNarrowFollowUp =
      assessment.probeValue === "high" &&
      assessment.followUpQuestion !== null &&
      assessment.directness !== "off_topic" &&
      remainingFollowUps > remainingPivots;
    if (worthOneNarrowFollowUp) {
      return {
        decision: "probe",
        probeKind: "deepen",
        nextQuestionOverride: null,
      };
    }

    return nextTopic
      ? {
          decision: "probe",
          probeKind: "pivot",
          nextQuestionOverride: nextTopic.question,
        }
      : { decision: "advance", probeKind: null, nextQuestionOverride: null };
  }

  if (!sufficient && canProbe) {
    let probeKind: ProbeKind = assessment.probeKind ?? "deepen";
    let nextQuestionOverride: string | null = null;

    if (stage.id === "resume_deep_dive") {
      const priorResumeTurns = session.turns.filter(
        (turn) => turn.stageId === "resume_deep_dive",
      );
      const lastProbeKind =
        priorResumeTurns.at(-1)?.assessment.probeKind ?? null;
      const pivotAlreadyUsed = priorResumeTurns.some(
        (turn) => turn.assessment.probeKind === "pivot",
      );

      if (probeKind === "deepen" && lastProbeKind === "deepen") {
        if (pivotAlreadyUsed) {
          canProbe = false;
        } else {
          probeKind = "pivot";
          nextQuestionOverride = pivotResumeQuestion(session.candidateBrief);
        }
      } else if (probeKind === "pivot") {
        if (pivotAlreadyUsed) {
          canProbe = false;
        } else {
          nextQuestionOverride = pivotResumeQuestion(session.candidateBrief);
        }
      }
    }

    if (canProbe) {
      return { decision: "probe", probeKind, nextQuestionOverride };
    }
  }

  if (session.currentStageIndex === session.stages.length - 1) {
    return { decision: "finish", probeKind: null, nextQuestionOverride: null };
  }

  return { decision: "advance", probeKind: null, nextQuestionOverride: null };
}
