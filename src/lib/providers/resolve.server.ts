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
  const modelCredentialConfigured = Boolean(
    process.env.OPENAI_API_KEY?.trim(),
  );
  const modelNameConfigured = Boolean(process.env.OPENAI_MODEL?.trim());
  const materialAnalysisConfigured =
    modelCredentialConfigured && modelNameConfigured;

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
      liveAdapterAvailable: false,
      mode: demoInterviewProvider.mode,
    },
    speechToText: {
      credentialConfigured: Boolean(process.env.STT_API_KEY?.trim()),
      liveAdapterAvailable: false,
      mode: demoSpeechToTextProvider.mode,
    },
  } as const;
}
