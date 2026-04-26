import { NextResponse } from "next/server";
import {
  acceptOffer,
  declineOffer,
  lookupOffer,
} from "@/server/waitlist-promotion";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const entry = await lookupOffer(params.token);
  if (!entry) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({
    guestName: entry.guestName,
    partySize: entry.partySize,
    venue: entry.venue,
    status: entry.status,
    expiresAt: entry.offerExpiresAt,
  });
}

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const limited = rateLimit(req, {
    key: `waitlist-offer:${params.token}`,
    max: 6,
    windowMs: 60_000,
  });
  if (!limited.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const action = new URL(req.url).searchParams.get("action") ?? "accept";
  try {
    if (action === "decline") {
      await declineOffer(params.token);
      return NextResponse.json({ ok: true });
    }
    const result = await acceptOffer(params.token);
    return NextResponse.json(result);
  } catch (err) {
    const code = err instanceof Error ? err.message : "unknown";
    const status =
      code === "not_found"
        ? 404
        : code === "expired" || code === "already_handled"
          ? 410
          : 400;
    return NextResponse.json({ error: code }, { status });
  }
}
