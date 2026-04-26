import { NextResponse } from "next/server";
import { verifyApiToken } from "@/server/api-tokens";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { tokenErrorResponse } from "@/lib/api-v1";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const limited = rateLimit(req, { key: "v1-me", max: 60, windowMs: 60_000 });
  if (!limited.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  try {
    const auth = await verifyApiToken(req);
    const venue = await db.venue.findUnique({
      where: { id: auth.venueId },
      select: { id: true, name: true, slug: true, city: true, currency: true, timezone: true },
    });
    return NextResponse.json({ tokenId: auth.id, scopes: auth.scopes, venue });
  } catch (err) {
    return tokenErrorResponse(err);
  }
}
