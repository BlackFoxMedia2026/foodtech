import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireScope, verifyApiToken } from "@/server/api-tokens";
import { rateLimit } from "@/lib/rate-limit";
import { tokenErrorResponse } from "@/lib/api-v1";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const limited = rateLimit(req, { key: "v1-guests", max: 60, windowMs: 60_000 });
  if (!limited.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  try {
    const auth = await verifyApiToken(req);
    requireScope(auth, "guests:read");
    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);
    const q = url.searchParams.get("q");
    const items = await db.guest.findMany({
      where: {
        venueId: auth.venueId,
        ...(q
          ? {
              OR: [
                { firstName: { contains: q, mode: "insensitive" } },
                { lastName: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
                { phone: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: { lastVisitAt: "desc" },
      take: limit,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        loyaltyTier: true,
        loyaltyPoints: true,
        totalVisits: true,
        lastVisitAt: true,
        marketingOptIn: true,
        tags: true,
      },
    });
    return NextResponse.json(items);
  } catch (err) {
    return tokenErrorResponse(err);
  }
}
