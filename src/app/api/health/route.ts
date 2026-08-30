import { NextResponse } from "next/server";
import { getProviderStatus } from "@/lib/providers/resolve.server";

export const dynamic = "force-dynamic";

export function GET() {
  const providers = getProviderStatus();

  return NextResponse.json({
    ok: true,
    service: process.env.NEXT_PUBLIC_APP_NAME ?? "ai-interview",
    mode: providers.activeMode,
    modelConfigured: providers.llmCredentialConfigured,
    speechConfigured: providers.sttCredentialConfigured,
    liveAdaptersAvailable: providers.liveAdaptersAvailable,
    timestamp: new Date().toISOString(),
  });
}
