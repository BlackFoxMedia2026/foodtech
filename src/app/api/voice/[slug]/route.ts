import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { recordInboundCall } from "@/server/voice";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Webhook endpoint for the voice provider (Twilio/Vapi/etc.) to forward
// transcripts and call metadata. Public; we authenticate by the venue slug
// + an optional shared secret in the header.
export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const secret = process.env.VOICE_WEBHOOK_SECRET;
  if (secret && req.headers.get("x-voice-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const limited = rateLimit(req, { key: `voice:${params.slug}`, max: 60, windowMs: 60_000 });
  if (!limited.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  try {
    const body = await req.json();
    const result = await recordInboundCall(params.slug, body);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "invalid_input", issues: err.issues }, { status: 400 });
    }
    const code = err instanceof Error ? err.message : "unknown";
    return NextResponse.json(
      { error: code },
      { status: code === "venue_not_found" ? 404 : 400 },
    );
  }
}
