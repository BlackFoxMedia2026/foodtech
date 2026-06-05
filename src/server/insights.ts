import { db } from "@/lib/db";
import { startOfDay, endOfDay } from "@/lib/utils";
import { notDeleted } from "@/server/soft-delete";
import { pushNotification } from "@/server/notifications";

export async function getOverview(venueId: string, day: Date = new Date()) {
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);

  const todayBookings = await db.booking.findMany({
    where: {
      venueId,
      startsAt: { gte: dayStart, lte: dayEnd },
      status: { not: "CANCELLED" },
      ...notDeleted,
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

// ─── Contesto proattivo per AI concierge ───────────────────────────────────────
// Fetcha in parallelo gli aggregati che servono alle heuristic "actionable":
// no-show risk imminente, VIP non assegnati, compleanni con booking attivo,
// occupancy off-peak, detrattori NPS, coupon in scadenza, attese in waitlist.

export type ProactiveContext = Awaited<ReturnType<typeof getProactiveContext>>;

export async function getProactiveContext(venueId: string, now: Date = new Date()) {
  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);
  const in60 = new Date(now.getTime() + 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [
    imminentBookings,
    todayBookingsForOccupancy,
    activeTablesCount,
    birthdayBookings,
    detractors,
    expiringCoupons,
    waitlistEntries,
  ] = await Promise.all([
    // Booking confermati nei prossimi 60min con guest details
    db.booking.findMany({
      where: {
        venueId,
        startsAt: { gte: now, lte: in60 },
        status: { in: ["CONFIRMED", "PENDING"] },
        ...notDeleted,
      },
      select: {
        id: true,
        startsAt: true,
        partySize: true,
        tableId: true,
        guest: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            noShowCount: true,
            loyaltyTier: true,
            birthday: true,
          },
        },
      },
      orderBy: { startsAt: "asc" },
    }),
    // Booking di oggi con startsAt + durationMin per calcolare occupancy oraria
    db.booking.findMany({
      where: {
        venueId,
        startsAt: { gte: dayStart, lte: dayEnd },
        status: { in: ["CONFIRMED", "PENDING", "SEATED"] },
        ...notDeleted,
      },
      select: { startsAt: true, durationMin: true, partySize: true },
    }),
    // Capacity proxy: somma seats dei tavoli attivi
    db.table.aggregate({
      where: { venueId, active: true },
      _sum: { seats: true },
    }).catch(() => ({ _sum: { seats: 0 } })),
    // Compleanni oggi con booking attivo
    db.booking.findMany({
      where: {
        venueId,
        startsAt: { gte: dayStart, lte: dayEnd },
        status: { in: ["CONFIRMED", "PENDING", "SEATED", "ARRIVED"] },
        guest: { birthday: { not: null } },
        ...notDeleted,
      },
      select: {
        id: true,
        startsAt: true,
        guest: {
          select: { id: true, firstName: true, lastName: true, birthday: true },
        },
      },
    }),
    // Detrattori NPS ultimi 7gg (npsScore <= 6)
    db.surveyResponse.findMany({
      where: {
        createdAt: { gte: sevenDaysAgo },
        npsScore: { lte: 6 },
        survey: { venueId },
      },
      select: {
        id: true,
        npsScore: true,
        sentiment: true,
        createdAt: true,
        survey: { select: { guestId: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    // Coupon attivi in scadenza entro 7gg
    db.coupon.findMany({
      where: {
        venueId,
        status: "ACTIVE",
        validUntil: { gte: now, lte: in7Days },
      },
      select: {
        id: true,
        name: true,
        validUntil: true,
        maxRedemptions: true,
        redemptionCount: true,
      },
    }),
    // Waitlist attiva con wait time
    db.waitlistEntry.findMany({
      where: {
        venueId,
        status: { in: ["WAITING", "OFFERED", "NOTIFIED"] },
      },
      select: {
        id: true,
        expectedWaitMin: true,
        createdAt: true,
      },
    }),
  ]);

  // Calcola occupancy nelle fasce 12-14 e 19-22 di oggi
  const lunchSlot = { from: 12, to: 14 };
  const dinnerSlot = { from: 19, to: 22 };
  const totalSeats = (activeTablesCount as { _sum: { seats: number | null } })._sum.seats ?? 0;

  function occupancyForSlot(slot: { from: number; to: number }) {
    if (totalSeats <= 0) return null;
    const slotStart = new Date(dayStart);
    slotStart.setHours(slot.from, 0, 0, 0);
    const slotEnd = new Date(dayStart);
    slotEnd.setHours(slot.to, 0, 0, 0);
    // Solo se il momento "now" è già nella fascia (no senso suggerire dopo)
    if (now < slotStart || now > slotEnd) return null;
    let covers = 0;
    for (const b of todayBookingsForOccupancy) {
      const bStart = new Date(b.startsAt);
      const bEnd = new Date(bStart.getTime() + (b.durationMin ?? 105) * 60 * 1000);
      // Overlap con la fascia
      if (bEnd > slotStart && bStart < slotEnd) covers += b.partySize;
    }
    return covers / totalSeats;
  }

  const lunchOccupancy = occupancyForSlot(lunchSlot);
  const dinnerOccupancy = occupancyForSlot(dinnerSlot);

  // ─── Proactive push notifications (fire-and-forget, idempotent) ──────────
  // Every time the AI concierge builds a brief we look at the same data we
  // already loaded above and synthesise in-app notifications. Because
  // pushNotification() dedupes by (venueId, kind, meta.sourceId) we can
  // safely call this on every brief invocation — repeated calls won't
  // create dupes for the same detractor / VIP booking.
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  for (const d of detractors) {
    if (d.sentiment !== "DETRACTOR") continue;
    if (d.createdAt < twentyFourHoursAgo) continue;
    void pushNotification({
      venueId,
      kind: "NPS_DETRACTOR",
      title: "Nuovo detrattore NPS",
      body: `Risposta con punteggio ${d.npsScore}/10 nelle ultime 24h. Apri il feedback per richiamare l'ospite.`,
      link: "/insights/feedback",
      role: "MANAGER",
      sourceId: d.id,
      metadata: { npsScore: d.npsScore, surveyResponseId: d.id },
    });
  }

  // VIP arriving in ≤30min senza tavolo → push reception (1 per booking/giorno)
  const in30 = new Date(now.getTime() + 30 * 60 * 1000);
  const today = now.toISOString().slice(0, 10);
  for (const b of imminentBookings) {
    if (b.tableId) continue;
    if (b.startsAt > in30) continue;
    const tier = b.guest?.loyaltyTier;
    if (tier !== "VIP" && tier !== "AMBASSADOR") continue;
    const name = `${b.guest?.firstName ?? ""} ${b.guest?.lastName ?? ""}`.trim() || "VIP";
    void pushNotification({
      venueId,
      kind: "VIP_UNASSIGNED",
      title: `VIP in arrivo senza tavolo: ${name}`,
      body: `Ospite ${tier} atteso alle ${b.startsAt.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })} (${b.partySize} pax) e non ha ancora un tavolo assegnato.`,
      link: "/reception",
      role: "RECEPTION",
      sourceId: `${b.id}:${today}`,
      metadata: { bookingId: b.id, tier },
    });
  }

  return {
    now,
    imminentBookings,
    birthdayBookings,
    detractors,
    expiringCoupons,
    waitlistEntries,
    lunchOccupancy,
    dinnerOccupancy,
    lunchSlot,
    dinnerSlot,
  };
}
