import { db } from "@/lib/db";

export type StaffMetrics = {
  userId: string | null;
  name: string;
  email: string;
  bookingsCreated: number;
  statusUpdates: number;
  noShows: number;
  cancellations: number;
  totalActions: number;
};

// We derive performance from BookingEvent rows tagged with actorId. The matrix
// exposes:
//  - bookings created by each staff member
//  - status changes they applied (seating, completion, cancellation)
//  - the resulting outcomes (no-show / cancelled) per actor
//
// This intentionally avoids any salary/PII data and stays inside the
// existing booking pipeline.

export async function staffPerformance(venueId: string, days = 30): Promise<StaffMetrics[]> {
  const since = new Date(Date.now() - days * 86400_000);
  const memberships = await db.venueMembership.findMany({
    where: { venueId },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  const events = await db.bookingEvent.findMany({
    where: {
      booking: { venueId },
      createdAt: { gte: since },
      actorId: { not: null },
    },
    select: {
      actorId: true,
      kind: true,
      message: true,
    },
  });

  const map = new Map<string, StaffMetrics>();
  for (const m of memberships) {
    map.set(m.user.id, {
      userId: m.user.id,
      name: m.user.name ?? m.user.email.split("@")[0],
      email: m.user.email,
      bookingsCreated: 0,
      statusUpdates: 0,
      noShows: 0,
      cancellations: 0,
      totalActions: 0,
    });
  }

  for (const e of events) {
    if (!e.actorId) continue;
    const row = map.get(e.actorId);
    if (!row) continue;
    row.totalActions++;
    if (e.kind === "CREATED") row.bookingsCreated++;
    if (e.kind === "STATUS_CHANGED") {
      row.statusUpdates++;
      if (e.message?.includes("NO_SHOW")) row.noShows++;
      if (e.message?.includes("CANCELLED")) row.cancellations++;
    }
  }
  return [...map.values()].sort((a, b) => b.totalActions - a.totalActions);
}

export async function staffSummary(venueId: string, days = 30) {
  const since = new Date(Date.now() - days * 86400_000);
  const [totalEvents, totalCreated, totalCompleted] = await Promise.all([
    db.bookingEvent.count({
      where: { booking: { venueId }, actorId: { not: null }, createdAt: { gte: since } },
    }),
    db.bookingEvent.count({
      where: {
        booking: { venueId },
        actorId: { not: null },
        kind: "CREATED",
        createdAt: { gte: since },
      },
    }),
    db.booking.count({
      where: { venueId, status: "COMPLETED", closedAt: { gte: since } },
    }),
  ]);
  return { totalEvents, totalCreated, totalCompleted };
}
