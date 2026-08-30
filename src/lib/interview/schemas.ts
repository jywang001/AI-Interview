import { z } from "zod";

export const P0_OBJECTIVE_COUNT = 4 as const;
export const P0_TURN_BUDGET = 5 as const;
export const P0_FOLLOW_UP_BUDGET = 1 as const;

export const ROLE_IDS = ["ai_algorithm", "ai_application"] as const;
export const RoleIdSchema = z.enum(ROLE_IDS);

export const SESSION_STATES = [
  "DRAFT",
  "MATERIAL_REVIEW",
  "PLAN_READY",
  "INTERVIEWING",
  "ANALYZING",
  "REVIEWED",
  "RETRAINING",
  "COMPLETED",
] as const;
export const SessionStateSchema = z.enum(SESSION_STATES);

export const EVIDENCE_SOURCE_TYPES = [
  "resume",
  "jd",
  "transcript",
  "role_profile",
] as const;

export const EvidenceReferenceSchema = z
  .object({
    id: z.string().min(1),
    sourceType: z.enum(EVIDENCE_SOURCE_TYPES),
    sourceId: z.string().min(1),
    excerpt: z.string().min(1),
    location: z.string().min(1).nullable().default(null),
    confirmed: z.boolean(),
    revisionId: z.string().min(1).nullable().default(null),
    startOffset: z.number().int().nonnegative().nullable().default(null),
    endOffset: z.number().int().positive().nullable().default(null),
  })
  .strict()
  .superRefine((reference, ctx) => {
    const hasStart = reference.startOffset !== null;
    const hasEnd = reference.endOffset !== null;

    if (hasStart !== hasEnd) {
      ctx.addIssue({
        code: "custom",
        message: "Evidence offsets must be provided together.",
        path: [hasStart ? "endOffset" : "startOffset"],
      });
    }

    if (
      reference.startOffset !== null &&
      reference.endOffset !== null &&
      reference.endOffset <= reference.startOffset
    ) {
      ctx.addIssue({
        code: "custom",
        message: "endOffset must be greater than startOffset.",
        path: ["endOffset"],
      });
    }

    if (reference.sourceType === "transcript") {
      if (!reference.confirmed) {
        ctx.addIssue({
          code: "custom",
          message: "Transcript evidence must reference a confirmed revision.",
          path: ["confirmed"],
        });
      }
      if (reference.revisionId === null) {
        ctx.addIssue({
          code: "custom",
          message: "Transcript evidence requires revisionId.",
          path: ["revisionId"],
        });
      }
      if (!hasStart || !hasEnd) {
        ctx.addIssue({
          code: "custom",
          message: "Transcript evidence requires exact text offsets.",
          path: ["startOffset"],
        });
      }
    }
  });

export const CompetencyWeightSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    description: z.string().min(1),
    weight: z.number().int().min(1).max(100),
  })
  .strict();

export const RoleProfileSchema = z
  .object({
    id: RoleIdSchema,
    label: z.string().min(1),
    summary: z.string().min(1),
    competencyWeights: z.array(CompetencyWeightSchema).min(4),
    requiredSignals: z.array(z.string().min(1)).min(3),
    scenarioConstraints: z.array(z.string().min(1)).min(1),
  })
  .strict()
  .superRefine((profile, ctx) => {
    const ids = profile.competencyWeights.map((item) => item.id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: "custom",
        message: "Role competency ids must be unique.",
        path: ["competencyWeights"],
      });
    }

    const totalWeight = profile.competencyWeights.reduce(
      (total, item) => total + item.weight,
      0,
    );
    if (totalWeight !== 100) {
      ctx.addIssue({
        code: "custom",
        message: "Role competency weights must sum to 100.",
        path: ["competencyWeights"],
      });
    }
  });

const CandidateProjectSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    context: z.string().min(1),
    responsibilities: z.array(z.string().min(1)).min(1),
    technologies: z.array(z.string().min(1)).min(1),
    confirmedClaims: z.array(z.string().min(1)).min(1),
    evidenceRefs: z.array(EvidenceReferenceSchema).min(1),
  })
  .strict();

const JobProfileSchema = z
  .object({
    title: z.string().min(1),
    companyLabel: z.string().min(1).nullable().default(null),
    responsibilities: z.array(z.string().min(1)).min(1),
    requiredSkills: z.array(z.string().min(1)).min(1),
    preferredSkills: z.array(z.string().min(1)).default([]),
    constraints: z.array(z.string().min(1)).default([]),
    evidenceRefs: z.array(EvidenceReferenceSchema).min(1),
  })
  .strict();

export const CandidateBriefSchema = z
  .object({
    id: z.string().min(1),
    displayName: z.string().min(1),
    roleId: RoleIdSchema,
    headline: z.string().min(1),
    education: z.array(z.string().min(1)).default([]),
    experienceHighlights: z.array(z.string().min(1)).default([]),
    projects: z.array(CandidateProjectSchema).min(1),
    skills: z.array(z.string().min(1)).min(1),
    job: JobProfileSchema,
    matchHighlights: z.array(z.string().min(1)).min(1),
    verificationRisks: z.array(z.string().min(1)).default([]),
    excludedUnconfirmedItems: z.array(z.string().min(1)).default([]),
    sourceEvidenceRefs: z.array(EvidenceReferenceSchema).min(1),
    confirmedAt: z.string().datetime({ offset: true }),
  })
  .strict()
  .superRefine((brief, ctx) => {
    const unconfirmedRefs = brief.sourceEvidenceRefs.filter(
      (reference) => !reference.confirmed,
    );
    if (unconfirmedRefs.length > 0) {
      ctx.addIssue({
        code: "custom",
        message: "CandidateBrief may only contain source-grounded evidence.",
        path: ["sourceEvidenceRefs"],
      });
    }
  });

export const OBJECTIVE_CATEGORIES = [
  "motivation",
  "resume_project",
  "role_technical",
  "applied_scenario",
] as const;

export const InterviewObjectiveSchema = z
  .object({
    id: z.string().min(1),
    order: z.number().int().min(1).max(P0_OBJECTIVE_COUNT),
    category: z.enum(OBJECTIVE_CATEGORIES),
    title: z.string().min(1),
    competencyIds: z.array(z.string().min(1)).min(1),
    sourceEvidenceRefs: z.array(EvidenceReferenceSchema).min(1),
    evidenceGoal: z.string().min(1),
    openingIntent: z.string().min(1),
    maxFollowUps: z.number().int().min(0).max(2),
    completionCriteria: z.array(z.string().min(1)).min(1),
    timeBudgetSeconds: z.number().int().positive(),
  })
  .strict();

export const TranscriptRevisionSchema = z
  .object({
    revisionId: z.string().min(1),
    answerSource: z.enum(["voice", "text"]),
    rawSttText: z.string().min(1).nullable().default(null),
    confirmedAnswerText: z.string().min(1),
    createdAt: z.string().datetime({ offset: true }),
    confirmedAt: z.string().datetime({ offset: true }),
    supersedesRevisionId: z.string().min(1).nullable().default(null),
    isCurrent: z.boolean(),
  })
  .strict()
  .superRefine((revision, ctx) => {
    if (revision.answerSource === "voice" && revision.rawSttText === null) {
      ctx.addIssue({
        code: "custom",
        message: "Voice answers require rawSttText before user confirmation.",
        path: ["rawSttText"],
      });
    }
    if (revision.answerSource === "text" && revision.rawSttText !== null) {
      ctx.addIssue({
        code: "custom",
        message: "Text answers must not include rawSttText.",
        path: ["rawSttText"],
      });
    }
  });

export const InterviewDecisionSchema = z.enum(["probe", "advance", "finish"]);

export const InterviewTurnSchema = z
  .object({
    id: z.string().min(1),
    index: z.number().int().min(1).max(P0_TURN_BUDGET),
    objectiveId: z.string().min(1),
    questionText: z.string().min(1),
    questionEvidenceRefs: z.array(EvidenceReferenceSchema).min(1),
    isDynamicFollowUp: z.boolean(),
    transcriptRevisions: z.array(TranscriptRevisionSchema).min(1),
    confirmedRevisionId: z.string().min(1),
    answerSource: z.enum(["voice", "text"]),
    decision: InterviewDecisionSchema,
    decisionReason: z.string().min(1),
    createdAt: z.string().datetime({ offset: true }),
    submittedAt: z.string().datetime({ offset: true }),
  })
  .strict()
  .superRefine((turn, ctx) => {
    const revisionIds = turn.transcriptRevisions.map(
      (revision) => revision.revisionId,
    );
    if (new Set(revisionIds).size !== revisionIds.length) {
      ctx.addIssue({
        code: "custom",
        message: "Transcript revision ids must be unique within a turn.",
        path: ["transcriptRevisions"],
      });
    }

    const currentRevisions = turn.transcriptRevisions.filter(
      (revision) => revision.isCurrent,
    );
    if (currentRevisions.length !== 1) {
      ctx.addIssue({
        code: "custom",
        message: "Each turn must have exactly one current transcript revision.",
        path: ["transcriptRevisions"],
      });
      return;
    }

    const confirmedRevision = currentRevisions[0];
    if (confirmedRevision.revisionId !== turn.confirmedRevisionId) {
      ctx.addIssue({
        code: "custom",
        message: "confirmedRevisionId must identify the current revision.",
        path: ["confirmedRevisionId"],
      });
    }
    if (confirmedRevision.answerSource !== turn.answerSource) {
      ctx.addIssue({
        code: "custom",
        message: "Turn answerSource must match its confirmed revision.",
        path: ["answerSource"],
      });
    }
  });

const P0ObjectivesSchema = z
  .array(InterviewObjectiveSchema)
  .length(P0_OBJECTIVE_COUNT);

export const InterviewSessionSchema = z
  .object({
    id: z.string().min(1),
    state: SessionStateSchema,
    language: z.literal("zh-CN"),
    mode: z.literal("quick"),
    difficulty: z.literal("medium"),
    objectiveCount: z.literal(P0_OBJECTIVE_COUNT),
    turnBudget: z.literal(P0_TURN_BUDGET),
    followUpBudget: z.literal(P0_FOLLOW_UP_BUDGET),
    roleProfile: RoleProfileSchema,
    candidateBrief: CandidateBriefSchema,
    objectives: P0ObjectivesSchema,
    turns: z.array(InterviewTurnSchema).max(P0_TURN_BUDGET),
    startedAt: z.string().datetime({ offset: true }).nullable().default(null),
    completedAt: z.string().datetime({ offset: true }).nullable().default(null),
  })
  .strict()
  .superRefine((session, ctx) => {
    if (session.roleProfile.id !== session.candidateBrief.roleId) {
      ctx.addIssue({
        code: "custom",
        message: "RoleProfile and CandidateBrief role ids must match.",
        path: ["candidateBrief", "roleId"],
      });
    }

    const objectiveIds = session.objectives.map((objective) => objective.id);
    if (new Set(objectiveIds).size !== P0_OBJECTIVE_COUNT) {
      ctx.addIssue({
        code: "custom",
        message: "P0 objective ids must be unique.",
        path: ["objectives"],
      });
    }

    session.objectives.forEach((objective, index) => {
      const expectedOrder = index + 1;
      const expectedCategory = OBJECTIVE_CATEGORIES[index];
      if (objective.order !== expectedOrder) {
        ctx.addIssue({
          code: "custom",
          message: `Objective order must be ${expectedOrder} at this position.`,
          path: ["objectives", index, "order"],
        });
      }
      if (objective.category !== expectedCategory) {
        ctx.addIssue({
          code: "custom",
          message: `P0 objective category must be ${expectedCategory}.`,
          path: ["objectives", index, "category"],
        });
      }
    });

    session.turns.forEach((turn, index) => {
      if (turn.index !== index + 1) {
        ctx.addIssue({
          code: "custom",
          message: "Turn indexes must be sequential.",
          path: ["turns", index, "index"],
        });
      }
      if (!objectiveIds.includes(turn.objectiveId)) {
        ctx.addIssue({
          code: "custom",
          message: "Turn objectiveId must reference this session's plan.",
          path: ["turns", index, "objectiveId"],
        });
      }
    });

    const requiresCompleteTranscript = [
      "ANALYZING",
      "REVIEWED",
      "RETRAINING",
      "COMPLETED",
    ].includes(session.state);

    if (requiresCompleteTranscript && session.turns.length !== P0_TURN_BUDGET) {
      ctx.addIssue({
        code: "custom",
        message: "P0 sessions require exactly five turns before analysis.",
        path: ["turns"],
      });
    }

    if (session.turns.length === P0_TURN_BUDGET) {
      const followUps = session.turns.filter((turn) => turn.isDynamicFollowUp);
      if (followUps.length !== P0_FOLLOW_UP_BUDGET) {
        ctx.addIssue({
          code: "custom",
          message: "P0 completed transcripts require one dynamic follow-up.",
          path: ["turns"],
        });
      }

      const objectiveTurnCounts = new Map<string, number>();
      session.turns.forEach((turn) => {
        objectiveTurnCounts.set(
          turn.objectiveId,
          (objectiveTurnCounts.get(turn.objectiveId) ?? 0) + 1,
        );
      });
      session.objectives.forEach((objective, index) => {
        const expectedCount = objective.category === "resume_project" ? 2 : 1;
        if ((objectiveTurnCounts.get(objective.id) ?? 0) !== expectedCount) {
          ctx.addIssue({
            code: "custom",
            message: `${objective.category} requires ${expectedCount} P0 turn(s).`,
            path: ["objectives", index],
          });
        }
      });

      if (session.turns.at(-1)?.decision !== "finish") {
        ctx.addIssue({
          code: "custom",
          message: "The fifth P0 turn must finish the interview.",
          path: ["turns", P0_TURN_BUDGET - 1, "decision"],
        });
      }
    }
  });

export const CompletedInterviewSessionSchema = InterviewSessionSchema.refine(
  (session) => session.turns.length === P0_TURN_BUDGET,
  { message: "A completed P0 session must contain exactly five turns." },
);

export const ASSESSMENT_DIMENSIONS = [
  "question_response",
  "ownership",
  "technical_reasoning",
  "result_evidence",
  "job_relevance",
] as const;

export const AssessmentItemSchema = z
  .object({
    dimension: z.enum(ASSESSMENT_DIMENSIONS),
    label: z.string().min(1),
    level: z.enum(["not_shown", "partial", "sufficient"]),
    evidenceRefs: z.array(EvidenceReferenceSchema).min(1),
    rationale: z.string().min(1),
    missingEvidence: z.array(z.string().min(1)).default([]),
    nextAction: z.string().min(1),
  })
  .strict();

const QuestionReviewSchema = z
  .object({
    turnId: z.string().min(1),
    evidenceRefs: z.array(EvidenceReferenceSchema).min(1),
    strengths: z.array(z.string().min(1)).default([]),
    gaps: z.array(z.string().min(1)).default([]),
    nextAction: z.string().min(1),
  })
  .strict();

const ResumeSuggestionSchema = z
  .object({
    sourceEvidenceRefs: z.array(EvidenceReferenceSchema).min(1),
    originalClaim: z.string().min(1),
    suggestion: z.string().min(1),
    needsUserConfirmation: z.boolean(),
  })
  .strict();

export const CoachReportSchema = z
  .object({
    id: z.string().min(1),
    sessionId: z.string().min(1),
    generatedAt: z.string().datetime({ offset: true }),
    overallReadiness: z.enum(["early", "developing", "interview_ready"]),
    summary: z.string().min(1),
    assessments: z.array(AssessmentItemSchema).length(5),
    priorityActions: z.array(z.string().min(1)).min(1).max(3),
    questionReviews: z.array(QuestionReviewSchema).length(P0_TURN_BUDGET),
    resumeSuggestions: z.array(ResumeSuggestionSchema).min(2),
  })
  .strict()
  .superRefine((report, ctx) => {
    const dimensions = report.assessments.map((item) => item.dimension);
    if (
      new Set(dimensions).size !== ASSESSMENT_DIMENSIONS.length ||
      ASSESSMENT_DIMENSIONS.some((dimension) => !dimensions.includes(dimension))
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Coach report must assess each P0 dimension exactly once.",
        path: ["assessments"],
      });
    }

    const turnIds = report.questionReviews.map((review) => review.turnId);
    if (new Set(turnIds).size !== P0_TURN_BUDGET) {
      ctx.addIssue({
        code: "custom",
        message: "Coach report question reviews must reference five unique turns.",
        path: ["questionReviews"],
      });
    }
  });

export const AttemptComparisonSchema = z
  .object({
    verdict: z.enum(["no_change", "improved", "regressed"]),
    summary: z.string().min(1),
    beforeEvidenceRefs: z.array(EvidenceReferenceSchema).min(1),
    afterEvidenceRefs: z.array(EvidenceReferenceSchema).min(1),
    evidenceAdded: z.array(z.string().min(1)).default([]),
    remainingGaps: z.array(z.string().min(1)).default([]),
  })
  .strict();

export const DrillAttemptSchema = z
  .object({
    id: z.string().min(1),
    sessionId: z.string().min(1),
    sourceTurnId: z.string().min(1),
    objectiveId: z.string().min(1),
    prompt: z.string().min(1),
    checklist: z.array(z.string().min(1)).min(2).max(3),
    submittedAt: z.string().datetime({ offset: true }),
    transcriptRevision: TranscriptRevisionSchema,
    comparison: AttemptComparisonSchema,
  })
  .strict();

export const DemoSessionFixtureSchema = z
  .object({
    session: CompletedInterviewSessionSchema,
    coachReport: CoachReportSchema,
    drillAttempt: DrillAttemptSchema,
  })
  .strict()
  .superRefine((fixture, ctx) => {
    if (fixture.coachReport.sessionId !== fixture.session.id) {
      ctx.addIssue({
        code: "custom",
        message: "Coach report must belong to the fixture session.",
        path: ["coachReport", "sessionId"],
      });
    }
    if (fixture.drillAttempt.sessionId !== fixture.session.id) {
      ctx.addIssue({
        code: "custom",
        message: "Drill attempt must belong to the fixture session.",
        path: ["drillAttempt", "sessionId"],
      });
    }

    const turnIds = new Set(fixture.session.turns.map((turn) => turn.id));
    if (!turnIds.has(fixture.drillAttempt.sourceTurnId)) {
      ctx.addIssue({
        code: "custom",
        message: "Drill attempt sourceTurnId must exist in the session.",
        path: ["drillAttempt", "sourceTurnId"],
      });
    }
  });

export type RoleId = z.infer<typeof RoleIdSchema>;
export type SessionState = z.infer<typeof SessionStateSchema>;
export type EvidenceReference = z.infer<typeof EvidenceReferenceSchema>;
export type RoleProfile = z.infer<typeof RoleProfileSchema>;
export type CandidateBrief = z.infer<typeof CandidateBriefSchema>;
export type InterviewObjective = z.infer<typeof InterviewObjectiveSchema>;
export type TranscriptRevision = z.infer<typeof TranscriptRevisionSchema>;
export type InterviewTurn = z.infer<typeof InterviewTurnSchema>;
export type InterviewSession = z.infer<typeof InterviewSessionSchema>;
export type CoachReport = z.infer<typeof CoachReportSchema>;
export type AttemptComparison = z.infer<typeof AttemptComparisonSchema>;
export type DrillAttempt = z.infer<typeof DrillAttemptSchema>;
export type DemoSessionFixture = z.infer<typeof DemoSessionFixtureSchema>;
