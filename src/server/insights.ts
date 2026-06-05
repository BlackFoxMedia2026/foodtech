import { db } from "@/lib/db";
import { startOfDay, endOfDay } from "@/lib/utils";

export async function getOverview(venueId: string, day: Date = new Date()) {
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);

  const todayBookings = await db.booking.findMany({
    where: {
      venueId,
      startsAt: { gte: dayStart, lte: dayEnd },
      status: { not: "CANCELLED" },
    },
    include: { guest: true, table: true },
    orderBy: { startsAt: "asc" },
  });

  const totalCovers = todayBookings.reduce((s, b) => s + b.partySize, 0);

  const noShowProb = await db.guest.aggregate({
    where: { venueId, totalVisits: { gt: 0 } },
    _avg: { noShowCount: true },
  });
  const expectedNoShow = Math.round((noShowProb._avg.noShowCount ?? 0) * todayBookings.length * 0.1);

  const avgSpend = await db.guest.aggregate({
    where: { venueId, totalVisits: { gt: 0 } },
    _avg: { totalSpend: true },
  });
  const estimatedRevenueCents =
    Math.round(((Number(avgSpend._avg.totalSpend ?? 45) * totalCovers) || 45 * totalCovers) * 100);

  // Trend ultimi 7 giorni — aggregato direttamente in SQL invece di
  // filtrare l'intero set in memoria (sul venue con migliaia di
  // prenotazioni questo loop scaricava facilmente 5-10k righe per
  // tirare fuori 7 numeri).
  const weekAgo = new Date(dayStart);
  weekAgo.setDate(dayStart.getDate() - 6);

  const rawTrend = await db.$queryRaw<
    { day: Date; covers: number; bookings: number }[]
  >`
    SELECT DATE_TRUNC('day', "startsAt")::date AS day,
           COALESCE(SUM("partySize"), 0)::int AS covers,
           COUNT(*)::int AS bookings
    FROM "Booking"
    WHERE "venueId" = ${venueId}
      AND "startsAt" >= ${weekAgo}
      AND "startsAt" <= ${dayEnd}
      AND "status" != 'CANCELLED'
    GROUP BY 1
    ORDER BY 1
  `;

  const trendByKey = new Map<string, { covers: number; bookings: number }>();
  for (const row of rawTrend) {
    const key = new Date(row.day).toISOString().slice(0, 10);
    trendByKey.set(key, { covers: row.covers, bookings: row.bookings });
  }

  const trend: { day: string; covers: number; bookings: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekAgo);
    d.setDate(weekAgo.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const slot = trendByKey.get(key);
    trend.push({
      day: d.toLocaleDateString("it-IT", { weekday: "short" }),
      covers: slot?.covers ?? 0,
      bookings: slot?.bookings ?? 0,
    });
  }

  // Alert
  const alerts: { kind: "warn" | "info" | "danger"; message: string }[] = [];
  const overbooked = todayBookings.filter((b) => !b.tableId);
  if (overbooked.length > 0) {
    alerts.push({ kind: "warn", message: `${overbooked.length} prenotazioni senza tavolo assegnato` });
  }
  const vips = todayBookings.filter((b) => b.guest && (b.guest.loyaltyTier === "VIP" || b.guest.loyaltyTier === "AMBASSADOR"));
  if (vips.length > 0) {
    alerts.push({ kind: "info", message: `${vips.length} ospiti VIP attesi oggi` });
  }
  const allergens = todayBookings.filter((b) => b.guest?.allergies);
  if (allergens.length > 0) {
    alerts.push({ kind: "danger", message: `${allergens.length} ospiti con allergie segnalate` });
  }

  return {
    todayBookings,
    totalCovers,
    expectedNoShow,
    estimatedRevenueCents,
    trend,
    alerts,
  };
}
