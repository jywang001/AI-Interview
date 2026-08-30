import {
  demoCandidateBrief,
  demoCoachReport,
  demoDrillAttempt,
  demoInterviewSession,
} from "@/fixtures/demo-session";
import type {
  InterviewAIProvider,
  InterviewResponseInput,
  SpeechToTextProvider,
  TranscriptionInput,
} from "./contracts";

export const demoInterviewProvider: InterviewAIProvider = {
  mode: "demo",

  async parseMaterials() {
    return demoCandidateBrief;
  },

  async createPlan() {
    return demoInterviewSession.objectives;
  },

  async respond(input: InterviewResponseInput) {
    const nextTurn = demoInterviewSession.turns[input.session.turns.length];
    if (!nextTurn) {
      throw new Error("The offline demo has reached its five-turn budget.");
    }
    return nextTurn;
  },

  async createReport() {
    return demoCoachReport;
  },

  async compareAttempt() {
    return demoDrillAttempt.comparison;
  },
};

export const demoSpeechToTextProvider: SpeechToTextProvider = {
  mode: "demo",

  async transcribe(input: TranscriptionInput) {
    return {
      requestId: input.requestId,
      rawText: "离线模式未上传音频。请编辑文字回答后提交。",
      provider: "offline-demo",
      durationMs: null,
    };
  },
};
