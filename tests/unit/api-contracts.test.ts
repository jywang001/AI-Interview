import { describe, expect, it } from "vitest";
import { GET as getHealth } from "@/app/api/health/route";
import { POST as postLiveReport } from "@/app/api/interview/live/report/route";
import { POST as postLiveRespond } from "@/app/api/interview/live/respond/route";
import { POST as postMaterials } from "@/app/api/materials/parse/route";
import { POST as postTranscription } from "@/app/api/speech/transcribe/route";

describe("API boundary contracts", () => {
  it("reports health and capability status without exposing credentials", async () => {
    const response = getHealth();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.capabilities).toEqual(
      expect.objectContaining({
        materialAnalysis: expect.any(Object),
        interview: expect.any(Object),
        speechToText: expect.any(Object),
        textToSpeech: expect.any(Object),
      }),
    );
    expect(JSON.stringify(body)).not.toMatch(/api[_-]?key|secret/i);
  });

  it.each([
    ["live respond", postLiveRespond, "http://localhost/api/interview/live/respond"],
    ["live report", postLiveReport, "http://localhost/api/interview/live/report"],
  ])("rejects malformed %s JSON", async (_label, handler, url) => {
    const response = await handler(
      new Request(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ invalid: true }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({ ok: false, code: "INVALID_INPUT" });
  });

  it("rejects a material request without a PDF or JD", async () => {
    const response = await postMaterials(
      new Request("http://localhost/api/materials/parse", {
        method: "POST",
        body: new FormData(),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({ ok: false, code: "INVALID_INPUT" });
  });

  it("rejects a transcription request without audio", async () => {
    const response = await postTranscription(
      new Request("http://localhost/api/speech/transcribe", {
        method: "POST",
        body: new FormData(),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({ ok: false, code: "INVALID_INPUT" });
  });
});
