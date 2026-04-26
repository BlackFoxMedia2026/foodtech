import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireScope, verifyApiToken } from "@/server/api-tokens";
import { rateLimit } from "@/lib/rate-limit";
import { tokenErrorResponse } from "@/lib/api-v1";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const limited = rateLimit(req, { key: "v1-orders", max: 120, windowMs: 60_000 });
  if (!limited.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  try {
    const auth = await verifyApiToken(req);
    requireScope(auth, "orders:read");
    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);
    const items = await db.order.findMany({
      where: { venueId: auth.venueId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { items: true },
    });
    return NextResponse.json(items);
  } catch (err) {
    return tokenErrorResponse(err);
  }
}
