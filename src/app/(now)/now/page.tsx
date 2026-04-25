import { redirect } from "next/navigation";
import { getActiveVenue } from "@/lib/tenant";
import { db } from "@/lib/db";
import { startOfDay, endOfDay } from "@/lib/utils";
import { NowBoard } from "@/components/now/now-board";

export const dynamic = "force-dynamic";

export default async function NowPage() {
  const ctx = await getActiveVenue().catch(() => null);
  if (!ctx) redirect("/sign-in");

  const today = new Date();
  const bookings = await db.booking.findMany({
    where: {
      venueId: ctx.venueId,
      startsAt: { gte: startOfDay(today), lte: endOfDay(today) },
      status: { in: ["CONFIRMED", "PENDING", "ARRIVED", "SEATED", "COMPLETED", "NO_SHOW"] },
    },
    include: {
      guest: { select: { firstName: true, lastName: true, phone: true, loyaltyTier: true } },
      table: { select: { label: true, seats: true } },
    },
    orderBy: { startsAt: "asc" },
  });

  const tables = await db.table.findMany({
    where: { venueId: ctx.venueId, active: true },
    select: { id: true, label: true, seats: true },
    orderBy: { label: "asc" },
  });

  const totalSeats = tables.reduce((acc, t) => acc + t.seats, 0);

  return (
    <NowBoard
      venueName={ctx.venue.name}
      totalSeats={totalSeats}
      tables={tables}
      bookings={bookings.map((b) => ({
        id: b.id,
        reference: b.reference,
        partySize: b.partySize,
        startsAt: b.startsAt.toISOString(),
        durationMin: b.durationMin,
        status: b.status,
        source: b.source,
        occasion: b.occasion,
        notes: b.notes,
        tableId: b.tableId,
        tableLabel: b.table?.label ?? null,
        guest: b.guest
          ? {
              firstName: b.guest.firstName,
              lastName: b.guest.lastName,
              phone: b.guest.phone,
              loyaltyTier: b.guest.loyaltyTier,
            }
          : null,
      }))}
    />
  );
}
