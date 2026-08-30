import {
  demoInterviewProvider,
  demoSpeechToTextProvider,
} from "./demo";

export function getInterviewProvider() {
  return demoInterviewProvider;
}

export function getSpeechToTextProvider() {
  return demoSpeechToTextProvider;
}

export function getProviderStatus() {
  return {
    activeMode: "demo" as const,
    llmCredentialConfigured: Boolean(process.env.OPENAI_API_KEY),
    sttCredentialConfigured: Boolean(process.env.STT_API_KEY),
    liveAdaptersAvailable: false,
  };
}
