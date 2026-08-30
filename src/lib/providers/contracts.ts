import type {
  AttemptComparison,
  CandidateBrief,
  CoachReport,
  DrillAttempt,
  InterviewObjective,
  InterviewSession,
  InterviewTurn,
  RoleId,
} from "@/lib/interview/schemas";

export type MaterialParseInput = Readonly<{
  roleId: RoleId;
  resumeText: string;
  jdText: string;
}>;

export type InterviewResponseInput = Readonly<{
  session: InterviewSession;
  confirmedAnswerText: string;
  revisionId: string;
  requestId: string;
}>;

export interface InterviewAIProvider {
  readonly mode: "demo" | "live";

  parseMaterials(input: MaterialParseInput): Promise<CandidateBrief>;

  createPlan(brief: CandidateBrief): Promise<readonly InterviewObjective[]>;

  respond(input: InterviewResponseInput): Promise<InterviewTurn>;

  createReport(session: InterviewSession): Promise<CoachReport>;

  compareAttempt(attempt: DrillAttempt): Promise<AttemptComparison>;
}

export type TranscriptionInput = Readonly<{
  audio: Blob;
  locale: "zh-CN" | "en-US";
  requestId: string;
}>;

export type TranscriptionResult = Readonly<{
  requestId: string;
  rawText: string;
  provider: string;
  durationMs: number | null;
}>;

export interface SpeechToTextProvider {
  readonly mode: "demo" | "live";
  transcribe(input: TranscriptionInput): Promise<TranscriptionResult>;
}
