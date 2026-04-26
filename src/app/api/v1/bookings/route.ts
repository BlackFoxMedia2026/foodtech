import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireScope, verifyApiToken } from "@/server/api-tokens";
import { rateLimit } from "@/lib/rate-limit";
import { tokenErrorResponse } from "@/lib/api-v1";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const limited = rateLimit(req, { key: "v1-bookings", max: 120, windowMs: 60_000 });
  if (!limited.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  try {
    const auth = await verifyApiToken(req);
    requireScope(auth, "bookings:read");
    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);
    const status = url.searchParams.get("status");
    const fromIso = url.searchParams.get("from");
    const toIso = url.searchParams.get("to");
    const items = await db.booking.findMany({
      where: {
        venueId: auth.venueId,
        ...(status ? { status: status as never } : {}),
        ...(fromIso || toIso
          ? {
              startsAt: {
                gte: fromIso ? new Date(fromIso) : undefined,
                lte: toIso ? new Date(toIso) : undefined,
              },
            }
          : {}),
      },
      orderBy: { startsAt: "desc" },
      take: limit,
      include: {
        guest: { select: { firstName: true, lastName: true, email: true, phone: true } },
        table: { select: { label: true } },
      },
    });
    return NextResponse.json(
      items.map((b) => ({
        id: b.id,
        reference: b.reference,
        startsAt: b.startsAt,
        partySize: b.partySize,
        status: b.status,
        source: b.source,
        notes: b.notes,
        depositCents: b.depositCents,
        depositStatus: b.depositStatus,
        isGroup: b.isGroup,
        eventType: b.eventType,
        guest: b.guest,
        tableLabel: b.table?.label ?? null,
      })),
    );
  } catch (err) {
    return tokenErrorResponse(err);
  }
}
