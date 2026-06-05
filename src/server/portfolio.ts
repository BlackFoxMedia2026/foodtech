import { db } from "@/lib/db";
import { startOfDay, endOfDay } from "@/lib/utils";
import { notDeleted } from "@/server/soft-delete";
import { getRatesTo } from "@/lib/fx";

export type VenueKpis = {
  venueId: string;
  venueName: string;
  city: string | null;
  currency: string;
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
  // Revenue is expressed in the venue's native currency for the venue card,
  // and additionally converted to the org baseCurrency for the aggregate.
  weekRevenueCents: number;
  weekRevenueCentsBase: number;
};

export async function getPortfolio(orgId: string) {
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { baseCurrency: true, name: true },
  });
  const baseCurrency = org?.baseCurrency ?? "EUR";

  const venues = await db.venue.findMany({
    where: { orgId, active: true },
    orderBy: { name: "asc" },
  });
  if (venues.length === 0) {
    return { venues: [], aggregate: emptyAggregate(baseCurrency), baseCurrency };
  }

  const today = new Date();
  const dayStart = startOfDay(today);
  const dayEnd = endOfDay(today);
  const weekStart = new Date(dayStart);
  weekStart.setDate(dayStart.getDate() - 6);

  const venueIds = venues.map((v) => v.id);

  const [allBookings, allTables, allGuests, allOrders] = await Promise.all([
    db.booking.findMany({
      where: { venueId: { in: venueIds }, startsAt: { gte: weekStart, lte: dayEnd }, ...notDeleted },
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
    db.order.findMany({
      where: {
        venueId: { in: venueIds },
        status: "COMPLETED",
        completedAt: { gte: weekStart, lte: dayEnd },
      },
      select: { venueId: true, totalCents: true },
    }),
  ]);

  const seatsByVenue = new Map<string, number>();
  for (const t of allTables) {
    seatsByVenue.set(t.venueId, (seatsByVenue.get(t.venueId) ?? 0) + t.seats);
  }

  const guestsByVenue = new Map<string, number>();
  for (const g of allGuests) guestsByVenue.set(g.venueId, g._count._all);

  const revenueByVenue = new Map<string, number>();
  for (const o of allOrders) {
    revenueByVenue.set(o.venueId, (revenueByVenue.get(o.venueId) ?? 0) + o.totalCents);
  }

  // Resolve FX rates once per distinct venue currency → baseCurrency. If a
  // pair is unresolvable (fx_unavailable) we drop it from the aggregate but
  // still surface the native value on the venue card. This keeps the portfolio
  // page from crashing when offline.
  const distinctCurrencies = Array.from(new Set(venues.map((v) => v.currency)));
  const rates = await getRatesTo(distinctCurrencies, baseCurrency);

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
    const weekRevenueCents = revenueByVenue.get(v.id) ?? 0;
    const rate = rates.get(v.currency) ?? (v.currency === baseCurrency ? 1 : null);
    const weekRevenueCentsBase =
      rate === null ? 0 : Math.round(weekRevenueCents * rate);
    return {
      venueId: v.id,
      venueName: v.name,
      city: v.city,
      currency: v.currency,
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
      weekRevenueCents,
      weekRevenueCentsBase,
    };
  });

  const aggregate = aggregateOf(venueKpis, baseCurrency, distinctCurrencies.length);

  const trend = buildTrend(allBookings, weekStart);

  return { venues: venueKpis, aggregate, trend, baseCurrency };
}

function emptyAggregate(baseCurrency: string) {
  return {
    todayBookings: 0,
    todayCovers: 0,
    weekCovers: 0,
    weekBookings: 0,
    avgUtilization: 0,
    avgNoShow: 0,
    totalCapacity: 0,
    totalGuests: 0,
    totalRevenueCents: 0,
    baseCurrency,
    convertedFromCurrencies: 0,
  };
}

function aggregateOf(
  venues: VenueKpis[],
  baseCurrency: string,
  distinctCurrencies: number,
) {
  const todayBookings = venues.reduce((s, v) => s + v.todayBookings, 0);
  const todayCovers = venues.reduce((s, v) => s + v.todayCovers, 0);
  const weekCovers = venues.reduce((s, v) => s + v.weekCovers, 0);
  const weekBookings = venues.reduce((s, v) => s + v.weekBookings, 0);
  const totalCapacity = venues.reduce((s, v) => s + v.capacityToday, 0);
  const totalGuests = venues.reduce((s, v) => s + v.guestCount, 0);
  const totalRevenueCents = venues.reduce((s, v) => s + v.weekRevenueCentsBase, 0);
  const avgUtilization = venues.length > 0
    ? Math.round(venues.reduce((s, v) => s + v.utilizationToday, 0) / venues.length)
    : 0;
  const avgNoShow = venues.length > 0
    ? Math.round(venues.reduce((s, v) => s + v.noShowRate, 0) / venues.length)
    : 0;
  return {
    todayBookings,
    todayCovers,
    weekCovers,
    weekBookings,
    avgUtilization,
    avgNoShow,
    totalCapacity,
    totalGuests,
    totalRevenueCents,
    baseCurrency,
    convertedFromCurrencies: distinctCurrencies,
  };
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
