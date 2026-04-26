import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireScope, verifyApiToken } from "@/server/api-tokens";
import { rateLimit } from "@/lib/rate-limit";
import { tokenErrorResponse } from "@/lib/api-v1";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const limited = rateLimit(req, { key: "v1-menu", max: 60, windowMs: 60_000 });
  if (!limited.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  try {
    const auth = await verifyApiToken(req);
    requireScope(auth, "menu:read");
    const categories = await db.menuCategory.findMany({
      where: { venueId: auth.venueId, active: true },
      orderBy: [{ ordering: "asc" }, { createdAt: "asc" }],
      include: {
        items: {
          where: { available: true },
          orderBy: { ordering: "asc" },
        },
      },
    });
    return NextResponse.json(categories);
  } catch (err) {
    return tokenErrorResponse(err);
  }
}
