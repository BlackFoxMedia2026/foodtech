import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { startChatSession } from "@/server/chat";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const limited = rateLimit(req, { key: `chat-start:${params.slug}`, max: 10, windowMs: 60_000 });
  if (!limited.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  try {
    const body = await req.json().catch(() => ({}));
    const result = await startChatSession(params.slug, body);
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
