import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { can, getActiveVenue } from "@/lib/tenant";
import { getPlanLimits, type PlanName } from "@/lib/plan-limits";
import { logAudit } from "@/server/audit";
import { suggestUpsells } from "@/server/upsell";

export const dynamic = "force-dynamic";

const Body = z.object({
  currentItems: z
    .array(
      z.object({
        menuItemId: z.string().nullable(),
        quantity: z.coerce.number().int().min(1).max(50),
      }),
    )
    .max(50),
});

export async function POST(
  req: Request,
  { params }: { params: { bookingId: string } },
) {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "manage_bookings")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // STARTER plan does not include the AI concierge — keep upsells off too.
  const plan = (ctx.org.plan ?? "STARTER") as PlanName;
  if (!getPlanLimits(plan).aiConcierge) {
    return NextResponse.json({ hints: [] });
  }

  // Multi-tenant guard: booking must belong to the active venue.
  const booking = await db.booking.findFirst({
    where: { id: params.bookingId, venueId: ctx.venueId },
    select: { id: true },
  });
  if (!booking) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const hints = await suggestUpsells({
    venueId: ctx.venueId,
    currentItems: body.currentItems,
  });

  if (hints.length > 0) {
    // Fire-and-forget audit trail (logAudit already swallows errors).
    // Diff carries the full (reason, suggestedItemIds[]) breakdown so the
    // CTR-ranking job can attribute each shown event to its specific item.
    void logAudit({
      orgId: ctx.orgId,
      venueId: ctx.venueId,
      actorId: ctx.userId,
      action: "preorder.upsell.shown",
      entityType: "Preorder",
      entityId: booking.id,
      diff: {
        hints: hints.map((h) => ({
          reason: h.reason,
          suggestedItemIds: h.suggestedItems.map((s) => s.id),
        })),
      },
    });
  }

  return NextResponse.json({ hints });
}
