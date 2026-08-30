export const PRESENTER_STATES = [
  "idle",
  "listening",
  "thinking",
  "speaking",
  "error",
] as const;

export type PresenterState = (typeof PRESENTER_STATES)[number];

export type PresenterCapabilities = Readonly<{
  hasVisual: boolean;
  supportsSpeech: boolean;
  supportsInterrupt: boolean;
  supportsLipSync: boolean;
  availablePersonaIds: readonly string[];
}>;

export type PresenterInitializeOptions = Readonly<{
  sessionId: string;
  personaId: string;
  locale: "zh-CN" | "en-US";
  mountTarget?: HTMLElement;
}>;

export type PresenterStateContext = Readonly<{
  questionId?: string;
  statusText?: string;
}>;

export type PresenterSpeakRequest = Readonly<{
  requestId: string;
  text: string;
  questionId?: string;
  voiceId?: string;
  interruptCurrent?: boolean;
}>;

export type PresenterSpeechResult = Readonly<{
  requestId: string;
  outcome: "completed" | "interrupted" | "unavailable";
  startedAt: string | null;
  endedAt: string | null;
}>;

export type PresenterEvent =
  | Readonly<{ type: "ready"; personaId: string }>
  | Readonly<{
      type: "state_changed";
      previous: PresenterState;
      current: PresenterState;
    }>
  | Readonly<{ type: "speech_started"; requestId: string }>
  | Readonly<{
      type: "speech_finished";
      requestId: string;
      outcome: PresenterSpeechResult["outcome"];
    }>
  | Readonly<{
      type: "error";
      operation: "initialize" | "set_state" | "speak" | "interrupt";
      message: string;
      recoverable: boolean;
    }>;

export type PresenterEventListener = (event: PresenterEvent) => void;

/**
 * Provider-neutral boundary for a static card, browser TTS, or a later remote
 * digital-human renderer. Interview state must remain valid when speech or
 * visuals are unavailable.
 */
export interface PresenterAdapter {
  readonly capabilities: PresenterCapabilities;

  initialize(options: PresenterInitializeOptions): Promise<void>;

  setState(
    state: PresenterState,
    context?: PresenterStateContext,
  ): Promise<void>;

  speak(request: PresenterSpeakRequest): Promise<PresenterSpeechResult>;

  interrupt(reason?: string): Promise<void>;

  subscribe(listener: PresenterEventListener): () => void;

  dispose(): Promise<void>;
}
