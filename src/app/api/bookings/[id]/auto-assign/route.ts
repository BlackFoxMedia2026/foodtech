import { NextResponse } from "next/server";
import { getActiveVenue } from "@/lib/tenant";
import { db } from "@/lib/db";
import { suggestAssignment } from "@/server/assign";
import { updateBooking } from "@/server/bookings";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getActiveVenue();
  const booking = await db.booking.findFirst({ where: { id: params.id, venueId: ctx.venueId } });
  if (!booking) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const suggestions = await suggestAssignment({
    venueId: ctx.venueId,
    partySize: booking.partySize,
    startsAt: booking.startsAt,
    durationMin: booking.durationMin,
    ignoreBookingId: booking.id,
  });
  return NextResponse.json({ suggestions });
}

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getActiveVenue();
  const booking = await db.booking.findFirst({ where: { id: params.id, venueId: ctx.venueId } });
  if (!booking) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const suggestions = await suggestAssignment({
    venueId: ctx.venueId,
    partySize: booking.partySize,
    startsAt: booking.startsAt,
    durationMin: booking.durationMin,
    ignoreBookingId: booking.id,
    maxResults: 1,
  });
  if (suggestions.length === 0) {
    return NextResponse.json({ error: "no_table_available" }, { status: 409 });
  }
  const top = suggestions[0];
  // For single tables we set tableId directly; for combinations we pick the
  // largest-of-the-pair so the booking is anchored, and put the secondary in
  // internalNotes to keep both tables visible to staff.
  let tableId = top.tableIds[0];
  let combinationNote: string | null = null;
  if (top.kind === "combination") {
    // pick the one with most seats as primary
    const tables = await db.table.findMany({
      where: { id: { in: top.tableIds }, venueId: ctx.venueId },
      select: { id: true, label: true, seats: true },
    });
    tables.sort((a, b) => b.seats - a.seats);
    tableId = tables[0].id;
    combinationNote = `Tavoli uniti: ${tables.map((t) => t.label).join(" + ")}`;
  }
  const updated = await updateBooking(
    ctx.venueId,
    booking.id,
    {
      tableId,
      ...(combinationNote ? { internalNotes: combinationNote } : {}),
    },
    { actorId: ctx.userId },
  );
  return NextResponse.json({ booking: updated, suggestion: top });
}
