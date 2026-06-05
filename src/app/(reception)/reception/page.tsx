import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getActiveVenue } from "@/lib/tenant";
import { listActiveBlocks } from "@/server/blocks";
import { listActiveWaitlist } from "@/server/waitlist";
import { startOfDay, endOfDay } from "@/lib/utils";
import type { TableLiveStatus } from "@/lib/floor";
import { ReceptionShell } from "@/components/reception/reception-shell";

export const dynamic = "force-dynamic";

type View = "sala" | "coda" | "arrivi";

export default async function ReceptionPage({
  searchParams,
}: {
  searchParams: { view?: string };
}) {
  const ctx = await getActiveVenue().catch(() => null);
  if (!ctx) redirect("/sign-in");

  const view: View =
    searchParams.view === "coda"
      ? "coda"
      : searchParams.view === "arrivi"
        ? "arrivi"
        : "sala";

  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 60_000);

  const room = await db.room.findFirst({ where: { venueId: ctx.venueId } });

  const [tables, decor, blocks, todayBookings, waitlist] = await Promise.all([
    db.table.findMany({
      where: { venueId: ctx.venueId, active: true },
      orderBy: { label: "asc" },
    }),
    db.floorDecor.findMany({
      where: { venueId: ctx.venueId },
      orderBy: { createdAt: "asc" },
    }),
    listActiveBlocks(ctx.venueId),
    db.booking.findMany({
      where: {
        venueId: ctx.venueId,
        startsAt: { gte: startOfDay(now), lte: endOfDay(now) },
        status: { in: ["CONFIRMED", "PENDING", "ARRIVED", "SEATED"] },
      },
      include: {
        guest: { select: { firstName: true, lastName: true, phone: true, loyaltyTier: true } },
        table: { select: { label: true, seats: true } },
      },
      orderBy: { startsAt: "asc" },
    }),
    listActiveWaitlist(ctx.venueId),
  ]);

  // -- Floor live data (same logic as /floor live)
  const bookingByTable = new Map<string, (typeof todayBookings)[number]>();
  for (const b of todayBookings) {
    if (!b.tableId) continue;
    const existing = bookingByTable.get(b.tableId);
    const priority: Record<string, number> = {
      SEATED: 4,
      ARRIVED: 3,
      CONFIRMED: 2,
      PENDING: 1,
    };
    if (!existing || priority[b.status] > priority[existing.status]) {
      bookingByTable.set(b.tableId, b);
    }
  }
  const blockedTableIds = new Set(
    blocks
      .filter((b) => new Date(b.startsAt) <= now && new Date(b.endsAt) >= now)
      .map((b) => b.tableId),
  );
  const liveTables = tables.map((t) => {
    const b = bookingByTable.get(t.id);
    let status: TableLiveStatus = "free";
    let guestName: string | null = null;
    let bookingId: string | null = null;
    let startsAt: string | null = null;
    let partySize: number | null = null;
    if (blockedTableIds.has(t.id)) {
      status = "blocked";
    } else if (b) {
      if (b.status === "SEATED") status = "seated";
      else if (b.status === "ARRIVED") status = "arrived";
      else status = "reserved";
      guestName = b.guest
        ? `${b.guest.firstName} ${b.guest.lastName ?? ""}`.trim()
        : "Walk-in";
      bookingId = b.id;
      startsAt = b.startsAt.toISOString();
      partySize = b.partySize;
    }
    return {
      id: t.id,
      label: t.label,
      seats: t.seats,
      shape: t.shape,
      posX: t.posX,
      posY: t.posY,
      rotation: t.rotation,
      status,
      guestName,
      bookingId,
      startsAt,
      partySize,
    };
  });

  // -- Prossimi arrivi (next 30 minuti)
  const upcoming = todayBookings.filter((b) => {
    const start = b.startsAt.getTime();
    return (
      (b.status === "CONFIRMED" || b.status === "PENDING") &&
      start >= now.getTime() - 10 * 60_000 &&
      start <= in30.getTime()
    );
  });

  const tableOpts = tables.map((t) => ({ id: t.id, label: t.label, seats: t.seats }));

  return (
    <ReceptionShell
      view={view}
      venueName={ctx.venue.name}
      room={{
        width: room?.width ?? 1200,
        height: room?.height ?? 760,
      }}
      liveTables={liveTables}
      tables={tableOpts}
      arrivals={upcoming.map((b) => ({
        id: b.id,
        partySize: b.partySize,
        startsAt: b.startsAt.toISOString(),
        status: b.status as "CONFIRMED" | "PENDING",
        tableLabel: b.table?.label ?? null,
        occasion: b.occasion,
        notes: b.notes,
        guest: b.guest
          ? {
              firstName: b.guest.firstName,
              lastName: b.guest.lastName,
              phone: b.guest.phone,
              loyaltyTier: b.guest.loyaltyTier,
            }
          : null,
      }))}
      waitlist={waitlist.map((w) => ({
        id: w.id,
        guestName: w.guestName,
        phone: w.phone,
        email: w.email,
        partySize: w.partySize,
        expectedWaitMin: w.expectedWaitMin,
        status: w.status,
        createdAt: w.createdAt.toISOString(),
        notifiedAt: w.notifiedAt?.toISOString() ?? null,
        notes: w.notes,
      }))}
    />
  );
}
