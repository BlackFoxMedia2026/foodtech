import { NextResponse } from "next/server";
import { can, getActiveVenue } from "@/lib/tenant";
import { db } from "@/lib/db";
import { offerNextWaitlistEntry } from "@/server/waitlist-promotion";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Manual promotion: admin clicks "Notifica prossimo" — we ignore the entry id
// and pick the oldest WAITING. Returns the chosen entryId.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "manage_bookings")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const entry = await db.waitlistEntry.findFirst({
    where: { id: params.id, venueId: ctx.venueId },
    select: { partySize: true },
  });
  if (!entry) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const result = await offerNextWaitlistEntry({
    venueId: ctx.venueId,
    partySize: entry.partySize,
  });
  return NextResponse.json(result);
}
