import { db } from "@/lib/db";
import { startOfDay, endOfDay } from "@/lib/utils";

export type VenueKpis = {
  venueId: string;
  venueName: string;
  city: string | null;
  todayBookings: number;
  todayCovers: number;
  weekCovers: number;
  weekBookings: number;
  noShowRate: number;
  capacityToday: number;
  utilizationToday: number;
  guestCount: number;
  vipShareToday: number;
  upcomingDeposits: number;
};

export async function getPortfolio(orgId: string) {
  const venues = await db.venue.findMany({
    where: { orgId, active: true },
    orderBy: { name: "asc" },
  });
  if (venues.length === 0) return { venues: [], aggregate: emptyAggregate() };

  const today = new Date();
  const dayStart = startOfDay(today);
  const dayEnd = endOfDay(today);
  const weekStart = new Date(dayStart);
  weekStart.setDate(dayStart.getDate() - 6);

  const venueIds = venues.map((v) => v.id);

  const [allBookings, allTables, allGuests] = await Promise.all([
    db.booking.findMany({
      where: { venueId: { in: venueIds }, startsAt: { gte: weekStart, lte: dayEnd } },
      select: {
        venueId: true,
        partySize: true,
        startsAt: true,
        status: true,
        depositCents: true,
        depositStatus: true,
        guest: { select: { loyaltyTier: true } },
      },
    }),
    db.table.findMany({
      where: { venueId: { in: venueIds }, active: true },
      select: { venueId: true, seats: true },
    }),
    db.guest.groupBy({
      by: ["venueId"],
      where: { venueId: { in: venueIds } },
      _count: { _all: true },
    }),
  ]);

  const seatsByVenue = new Map<string, number>();
  for (const t of allTables) {
    seatsByVenue.set(t.venueId, (seatsByVenue.get(t.venueId) ?? 0) + t.seats);
  }

  const guestsByVenue = new Map<string, number>();
  for (const g of allGuests) guestsByVenue.set(g.venueId, g._count._all);

  const venueKpis: VenueKpis[] = venues.map((v) => {
    const own = allBookings.filter((b) => b.venueId === v.id);
    const today = own.filter((b) => b.startsAt >= dayStart && b.startsAt <= dayEnd && b.status !== "CANCELLED");
    const noShow = own.filter((b) => b.status === "NO_SHOW").length;
    const completed = own.filter((b) => b.status === "COMPLETED" || b.status === "NO_SHOW").length;
    const vips = today.filter((b) => b.guest?.loyaltyTier === "VIP" || b.guest?.loyaltyTier === "AMBASSADOR").length;
    const upcomingDeposits = own.filter(
      (b) => b.depositStatus === "HELD" && b.startsAt >= dayStart,
    ).length;
    const capacity = seatsByVenue.get(v.id) ?? 0;
    const todayCovers = today.reduce((s, b) => s + b.partySize, 0);
    return {
      venueId: v.id,
      venueName: v.name,
      city: v.city,
      todayBookings: today.length,
      todayCovers,
      weekCovers: own.filter((b) => b.status !== "CANCELLED").reduce((s, b) => s + b.partySize, 0),
      weekBookings: own.filter((b) => b.status !== "CANCELLED").length,
      noShowRate: completed > 0 ? Math.round((noShow / completed) * 100) : 0,
      capacityToday: capacity,
      utilizationToday: capacity > 0 ? Math.min(100, Math.round((todayCovers / capacity) * 100)) : 0,
      guestCount: guestsByVenue.get(v.id) ?? 0,
      vipShareToday: today.length > 0 ? Math.round((vips / today.length) * 100) : 0,
      upcomingDeposits,
    };
  });

  const aggregate = aggregateOf(venueKpis, allBookings, dayStart, weekStart, dayEnd);

  const trend = buildTrend(allBookings, weekStart);

  return { venues: venueKpis, aggregate, trend };
}

function emptyAggregate() {
  return {
    todayBookings: 0,
    todayCovers: 0,
    weekCovers: 0,
    weekBookings: 0,
    avgUtilization: 0,
    avgNoShow: 0,
    totalCapacity: 0,
    totalGuests: 0,
  };
}

function aggregateOf(
  venues: VenueKpis[],
  bookings: { venueId: string; partySize: number; startsAt: Date; status: string }[],
  dayStart: Date,
  _weekStart: Date,
  dayEnd: Date,
) {
  const todayBookings = venues.reduce((s, v) => s + v.todayBookings, 0);
  const todayCovers = venues.reduce((s, v) => s + v.todayCovers, 0);
  const weekCovers = venues.reduce((s, v) => s + v.weekCovers, 0);
  const weekBookings = venues.reduce((s, v) => s + v.weekBookings, 0);
  const totalCapacity = venues.reduce((s, v) => s + v.capacityToday, 0);
  const totalGuests = venues.reduce((s, v) => s + v.guestCount, 0);
  const avgUtilization = venues.length > 0
    ? Math.round(venues.reduce((s, v) => s + v.utilizationToday, 0) / venues.length)
    : 0;
  const avgNoShow = venues.length > 0
    ? Math.round(venues.reduce((s, v) => s + v.noShowRate, 0) / venues.length)
    : 0;
  // bookings unused beyond aggregation — kept for future cross-venue comparisons
  void bookings;
  void dayStart;
  void dayEnd;
  return { todayBookings, todayCovers, weekCovers, weekBookings, avgUtilization, avgNoShow, totalCapacity, totalGuests };
}

function buildTrend(
  bookings: { venueId: string; partySize: number; startsAt: Date; status: string }[],
  weekStart: Date,
) {
  const days: { day: string; iso: string; covers: number; bookings: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const filtered = bookings.filter(
      (b) => b.startsAt.toISOString().slice(0, 10) === iso && b.status !== "CANCELLED",
    );
    days.push({
      day: d.toLocaleDateString("it-IT", { weekday: "short" }),
      iso,
      covers: filtered.reduce((s, b) => s + b.partySize, 0),
      bookings: filtered.length,
    });
  }
  return days;
}
