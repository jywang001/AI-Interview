import { demoSessionFixture } from "@/fixtures/demo-session";

export function GET() {
  return Response.json(
    {
      mode: "demo",
      fixture: demoSessionFixture,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
