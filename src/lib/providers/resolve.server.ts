import {
  demoInterviewProvider,
  demoSpeechToTextProvider,
} from "./demo";
import { volcSpeechToTextProvider } from "@/lib/speech/volc-stt.server";

function hasVolcSpeechCredentials() {
  return Boolean(
    process.env.VOLC_SPEECH_API_KEY?.trim() ||
      (process.env.VOLC_SPEECH_APP_KEY?.trim() &&
        process.env.VOLC_SPEECH_ACCESS_KEY?.trim()),
  );
}

function hasVolcTtsCredentials() {
  return Boolean(
    process.env.VOLC_SPEECH_API_KEY?.trim() ||
      process.env.VOLC_TTS_API_KEY?.trim(),
  );
}

export function getInterviewProvider() {
  return demoInterviewProvider;
}

export function getSpeechToTextProvider() {
  return hasVolcSpeechCredentials()
    ? volcSpeechToTextProvider
    : demoSpeechToTextProvider;
}

export function getProviderStatus() {
  const modelCredentialConfigured = Boolean(
    process.env.OPENAI_API_KEY?.trim(),
  );
  const modelNameConfigured = Boolean(process.env.OPENAI_MODEL?.trim());
  const materialAnalysisConfigured =
    modelCredentialConfigured && modelNameConfigured;
  const volcSpeechCredentialConfigured = hasVolcSpeechCredentials();
  const volcTtsCredentialConfigured = hasVolcTtsCredentials();
  const volcTtsSpeakerConfigured = Boolean(
    process.env.VOLC_TTS_SPEAKER?.trim(),
  );

  return {
    activeMode: "hybrid" as const,
    materialAnalysis: {
      adapterAvailable: true,
      configured: materialAnalysisConfigured,
      credentialConfigured: modelCredentialConfigured,
      modelConfigured: modelNameConfigured,
      mode: materialAnalysisConfigured
        ? ("live" as const)
        : ("unconfigured" as const),
    },
    interview: {
      provider: "openai-compatible",
      credentialConfigured: modelCredentialConfigured,
      modelConfigured: modelNameConfigured,
      liveAdapterAvailable: true,
      demoFallbackAvailable: true,
      mode: materialAnalysisConfigured
        ? ("live" as const)
        : demoInterviewProvider.mode,
    },
    speechToText: {
      provider: "volc-doubao",
      credentialConfigured: volcSpeechCredentialConfigured,
      liveAdapterAvailable: true,
      mode: volcSpeechCredentialConfigured
        ? ("live" as const)
        : demoSpeechToTextProvider.mode,
    },
    textToSpeech: {
      provider: "volc-doubao",
      credentialConfigured: volcTtsCredentialConfigured,
      voiceConfigured: volcTtsSpeakerConfigured,
      liveAdapterAvailable: true,
      textFallbackAvailable: true,
      mode:
        volcTtsCredentialConfigured && volcTtsSpeakerConfigured
          ? ("live" as const)
          : ("text-fallback" as const),
    },
  } as const;
}
