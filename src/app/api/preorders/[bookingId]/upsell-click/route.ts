import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { can, getActiveVenue } from "@/lib/tenant";
import { logAudit } from "@/server/audit";

export const dynamic = "force-dynamic";

const Body = z.object({
  reason: z.string().max(40),
  menuItemId: z.string().max(64),
});

// Lightweight click telemetry. Used by PreorderEditor when the guest taps
// "+" on a suggested item. Separate from the suggestions endpoint so we
// can opt-out of analytics without touching the recommendation flow.
export async function POST(
  req: Request,
  { params }: { params: { bookingId: string } },
) {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "manage_bookings")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const booking = await db.booking.findFirst({
    where: { id: params.bookingId, venueId: ctx.venueId },
    select: { id: true },
  });
  if (!booking) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  void logAudit({
    orgId: ctx.orgId,
    venueId: ctx.venueId,
    actorId: ctx.userId,
    action: "preorder.upsell.clicked",
    entityType: "Preorder",
    entityId: booking.id,
    diff: { reason: body.reason, menuItemId: body.menuItemId },
  });

  return NextResponse.json({ ok: true });
}
