import { NextResponse } from "next/server";
import { getProviderStatus } from "@/lib/providers/resolve.server";

export const dynamic = "force-dynamic";

export function GET() {
  const providers = getProviderStatus();

  return NextResponse.json({
    ok: true,
    service: process.env.NEXT_PUBLIC_APP_NAME ?? "ai-interview",
    mode: providers.activeMode,
    capabilities: {
      materialAnalysis: providers.materialAnalysis,
      interview: providers.interview,
      speechToText: providers.speechToText,
      textToSpeech: providers.textToSpeech,
    },
    timestamp: new Date().toISOString(),
  });
}
