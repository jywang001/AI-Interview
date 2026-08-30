type SpeechOperation = "stt" | "tts";

const WINDOW_MS = 60_000;
const LIMITS: Record<
  SpeechOperation,
  { maxAcceptedPerWindow: number; maxConcurrent: number }
> = {
  stt: { maxAcceptedPerWindow: 12, maxConcurrent: 2 },
  tts: { maxAcceptedPerWindow: 30, maxConcurrent: 4 },
};

const state: Record<
  SpeechOperation,
  { windowStartedAt: number; acceptedInWindow: number; active: number }
> = {
  stt: { windowStartedAt: Date.now(), acceptedInWindow: 0, active: 0 },
  tts: { windowStartedAt: Date.now(), acceptedInWindow: 0, active: 0 },
};

export function reserveSpeechRequest(
  operation: SpeechOperation,
  now = Date.now(),
) {
  const current = state[operation];
  const limit = LIMITS[operation];

  if (now - current.windowStartedAt >= WINDOW_MS) {
    current.windowStartedAt = now;
    current.acceptedInWindow = 0;
  }

  if (
    current.acceptedInWindow >= limit.maxAcceptedPerWindow ||
    current.active >= limit.maxConcurrent
  ) {
    return null;
  }

  current.acceptedInWindow += 1;
  current.active += 1;
  let released = false;

  return () => {
    if (released) return;
    released = true;
    current.active = Math.max(0, current.active - 1);
  };
}
