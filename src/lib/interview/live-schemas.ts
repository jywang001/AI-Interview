import { z } from "zod";
import {
  CandidateBriefSchema,
  RoleIdSchema,
  RoleProfileSchema,
} from "@/lib/interview/schemas";

export const LIVE_STAGE_IDS = [
  "self_intro",
  "resume_deep_dive",
  "role_knowledge",
  "algorithm_reasoning",
  "motivation_availability",
  "candidate_questions",
] as const;

export const LiveStageIdSchema = z.enum(LIVE_STAGE_IDS);
export const InterviewModeSchema = z.enum(["quick", "realistic"]);
export const LiveSessionStateSchema = z.enum([
  "READY",
  "INTERVIEWING",
  "ANALYZING",
  "REVIEWED",
]);

export const AlgorithmProblemSchema = z
  .object({
    slug: z.string().min(1).max(100),
    title: z.string().min(1).max(100),
    difficulty: z.enum(["easy", "medium", "hard"]),
    thinkingTimeSeconds: z.number().int().min(300).max(600),
    prompt: z.string().min(1).max(500),
    sourceLabel: z.literal("LeetCode Hot 100"),
  })
  .strict();

export const EvidencePrioritySchema = z.enum(["must", "should", "optional"]);
export const SlotStatusSchema = z.enum([
  "missing",
  "partial",
  "covered",
  "contradicted",
]);

export const StageSlotSchema = z
  .object({
    id: z.string().min(1).max(80),
    label: z.string().min(1).max(80),
    description: z.string().min(1).max(300),
    priority: EvidencePrioritySchema,
  })
  .strict();

export const LiveStageSchema = z
  .object({
    id: LiveStageIdSchema,
    order: z.number().int().min(1).max(LIVE_STAGE_IDS.length),
    title: z.string().min(1).max(80),
    purpose: z.string().min(1).max(300),
    slots: z.array(StageSlotSchema).min(1).max(10),
    maxFollowUps: z.number().int().min(1).max(8),
    timeBudgetSeconds: z.number().int().min(60).max(1_800),
  })
  .strict();

export const SlotUpdateSchema = z
  .object({
    slotId: z.string().min(1).max(80),
    status: SlotStatusSchema,
    evidenceQuote: z.string().min(1).max(500).nullable(),
    rationale: z.string().min(1).max(240),
  })
  .strict();

export const TurnAssessmentSchema = z
  .object({
    directness: z.enum(["sufficient", "partial", "off_topic"]),
    slotUpdates: z.array(SlotUpdateSchema).min(1).max(10),
    criticalMissingSlotIds: z.array(z.string().min(1).max(80)).max(10),
    probeValue: z.enum(["high", "low"]),
    probeKind: z.enum(["deepen", "pivot"]).nullable(),
    decisionSummary: z.string().min(1).max(300),
    followUpAnchor: z.string().min(1).max(500).nullable(),
  })
  .strict();

export const LiveInterviewTurnSchema = z
  .object({
    id: z.string().min(1).max(160),
    index: z.number().int().positive().max(40),
    stageId: LiveStageIdSchema,
    stageTurnIndex: z.number().int().positive().max(10),
    questionText: z.string().min(1).max(600),
    answerSource: z.enum(["voice", "text"]),
    rawSttText: z.string().min(1).max(8_000).nullable(),
    confirmedAnswerText: z.string().min(1).max(8_000),
    assessment: TurnAssessmentSchema,
    decision: z.enum(["probe", "advance", "finish"]),
    createdAt: z.string().datetime({ offset: true }),
    submittedAt: z.string().datetime({ offset: true }),
  })
  .strict()
  .superRefine((turn, ctx) => {
    if (turn.answerSource === "voice" && turn.rawSttText === null) {
      ctx.addIssue({
        code: "custom",
        message: "Voice turns require raw STT text.",
        path: ["rawSttText"],
      });
    }
    if (turn.answerSource === "text" && turn.rawSttText !== null) {
      ctx.addIssue({
        code: "custom",
        message: "Text turns cannot include raw STT text.",
        path: ["rawSttText"],
      });
    }
  });

export const LiveInterviewSessionSchema = z
  .object({
    id: z.string().min(1).max(160),
    state: LiveSessionStateSchema,
    mode: InterviewModeSchema,
    roleId: RoleIdSchema,
    roleProfile: RoleProfileSchema,
    candidateBrief: CandidateBriefSchema,
    stages: z.array(LiveStageSchema).length(LIVE_STAGE_IDS.length),
    currentStageIndex: z.number().int().min(0).max(LIVE_STAGE_IDS.length - 1),
    currentQuestionText: z.string().min(1).max(600),
    algorithmProblem: AlgorithmProblemSchema,
    algorithmThinkingEndsAt: z.string().datetime({ offset: true }).nullable(),
    algorithmThinkingCompletedAt: z
      .string()
      .datetime({ offset: true })
      .nullable(),
    turns: z.array(LiveInterviewTurnSchema).max(40),
    startedAt: z.string().datetime({ offset: true }),
    completedAt: z.string().datetime({ offset: true }).nullable(),
  })
  .strict()
  .superRefine((session, ctx) => {
    if (session.roleId !== session.roleProfile.id) {
      ctx.addIssue({
        code: "custom",
        message: "Role profile does not match the selected role.",
        path: ["roleProfile", "id"],
      });
    }
    session.stages.forEach((stage, index) => {
      if (stage.id !== LIVE_STAGE_IDS[index] || stage.order !== index + 1) {
        ctx.addIssue({
          code: "custom",
          message: "Live interview stages must use the locked order.",
          path: ["stages", index],
        });
      }
    });
  });

export const REPORT_CRITERIA = [
  "directness",
  "specificity",
  "reasoning",
  "correctness",
  "relevance",
  "communication",
  "reflection",
] as const;

export const ReportCriteriaScoresSchema = z
  .object({
    directness: z.number().int().min(0).max(4),
    specificity: z.number().int().min(0).max(4),
    reasoning: z.number().int().min(0).max(4),
    correctness: z.number().int().min(0).max(4),
    relevance: z.number().int().min(0).max(4),
    communication: z.number().int().min(0).max(4),
    reflection: z.number().int().min(0).max(4),
  })
  .strict();

export const ReportEvidenceSchema = z
  .object({
    turnId: z.string().min(1).max(160),
    quote: z.string().min(1).max(500),
  })
  .strict();

export const StageReportSchema = z
  .object({
    stageId: LiveStageIdSchema,
    title: z.string().min(1).max(80),
    score: z.number().int().min(0).max(100),
    stars: z.number().int().min(1).max(5),
    criteria: ReportCriteriaScoresSchema,
    rationale: z.string().min(1).max(500),
    evidence: z.array(ReportEvidenceSchema).min(1).max(3),
    strengths: z.array(z.string().min(1).max(200)).max(3),
    gaps: z.array(z.string().min(1).max(200)).max(3),
    nextAction: z.string().min(1).max(300),
  })
  .strict();

export const LiveCoachReportSchema = z
  .object({
    id: z.string().min(1).max(160),
    sessionId: z.string().min(1).max(160),
    generatedAt: z.string().datetime({ offset: true }),
    overallScore: z.number().int().min(0).max(100),
    summary: z.string().min(1).max(800),
    stageReports: z.array(StageReportSchema).length(LIVE_STAGE_IDS.length),
    priorityActions: z.array(z.string().min(1).max(300)).min(1).max(3),
    recruiterNotes: z.array(z.string().min(1).max(300)).max(5),
    disclaimer: z.string().min(1).max(300),
  })
  .strict();

export type InterviewMode = z.infer<typeof InterviewModeSchema>;
export type LiveStageId = z.infer<typeof LiveStageIdSchema>;
export type LiveStage = z.infer<typeof LiveStageSchema>;
export type LiveInterviewTurn = z.infer<typeof LiveInterviewTurnSchema>;
export type LiveInterviewSession = z.infer<typeof LiveInterviewSessionSchema>;
export type LiveCoachReport = z.infer<typeof LiveCoachReportSchema>;
export type AlgorithmProblem = z.infer<typeof AlgorithmProblemSchema>;
