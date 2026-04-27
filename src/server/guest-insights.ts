import { db } from "@/lib/db";

// "Smart segments": ready-to-act views over the existing CRM data so the
// operator never has to write a SQL query to find the right people.
//
// Postgres can't filter directly by month-of-year on a DateTime field
// without a server-side function, so we fetch a small slice (guests with
// a birthday set) and compute month/day in memory. The slice is bounded
// by venueId + birthday IS NOT NULL, so even on a large CRM it stays
// trivially small.

export type GuestSummary = {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  loyaltyTier: string;
  totalVisits: number;
  lastVisitAt: Date | null;
  marketingOptIn: boolean;
  birthday: Date | null;
  allergies: string | null;
};

export type SegmentInsights = {
  birthdaysToday: GuestSummary[];
  birthdaysWeek: GuestSummary[];
  atRisk: GuestSummary[];
  vipsArrivingToday: Array<{
    bookingId: string;
    startsAt: Date;
    partySize: number;
    occasion: string | null;
    guest: GuestSummary;
  }>;
  recentReturning: GuestSummary[];
  todaysAllergies: Array<{
    bookingId: string;
    startsAt: Date;
    partySize: number;
    guestName: string;
    allergies: string;
  }>;
};

const AT_RISK_DAYS = 60;
const RETURNING_WINDOW_DAYS = 30;
const RETURNING_MIN_VISITS = 2;

function daysFromToday(date: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setFullYear(today.getFullYear());
  target.setHours(0, 0, 0, 0);
  let diff = Math.floor((target.getTime() - today.getTime()) / 86400_000);
  if (diff < 0) diff += 365; // wrap to next year
  return diff;
}

export async function getSegmentInsights(venueId: string): Promise<SegmentInsights> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  const since = new Date(Date.now() - AT_RISK_DAYS * 86400_000);
  const recentSince = new Date(Date.now() - RETURNING_WINDOW_DAYS * 86400_000);

  const [
    birthdayCandidates,
    atRiskRows,
    todaysBookings,
    recentReturningRows,
  ] = await Promise.all([
    db.guest.findMany({
      where: { venueId, birthday: { not: null } },
      select: guestSummarySelect(),
      take: 5000,
    }),
    db.guest.findMany({
      where: {
        venueId,
        marketingOptIn: true,
        blocked: false,
        totalVisits: { gt: 0 },
        lastVisitAt: { lt: since },
      },
      orderBy: { lastVisitAt: "asc" },
      take: 50,
      select: guestSummarySelect(),
    }),
    db.booking.findMany({
      where: {
        venueId,
        startsAt: { gte: todayStart, lt: tomorrowStart },
        status: { in: ["CONFIRMED", "PENDING", "ARRIVED", "SEATED"] },
      },
      orderBy: { startsAt: "asc" },
      include: {
        guest: { select: guestSummarySelect() },
      },
    }),
    db.guest.findMany({
      where: {
        venueId,
        lastVisitAt: { gte: recentSince },
        totalVisits: { gte: RETURNING_MIN_VISITS },
      },
      orderBy: [{ lastVisitAt: "desc" }, { totalVisits: "desc" }],
      take: 12,
      select: guestSummarySelect(),
    }),
  ]);

  const todayMonth = new Date().getMonth();
  const todayDay = new Date().getDate();

  const birthdaysToday: GuestSummary[] = [];
  const birthdaysWeek: GuestSummary[] = [];
  for (const g of birthdayCandidates) {
    if (!g.birthday) continue;
    const d = daysFromToday(g.birthday);
    if (g.birthday.getMonth() === todayMonth && g.birthday.getDate() === todayDay) {
      birthdaysToday.push(g);
    } else if (d > 0 && d <= 7) {
      birthdaysWeek.push(g);
    }
  }
  birthdaysWeek.sort((a, b) => {
    if (!a.birthday || !b.birthday) return 0;
    return daysFromToday(a.birthday) - daysFromToday(b.birthday);
  });

  const vipsArrivingToday = todaysBookings
    .filter(
      (b) =>
        b.guest && (b.guest.loyaltyTier === "VIP" || b.guest.loyaltyTier === "AMBASSADOR"),
    )
    .map((b) => ({
      bookingId: b.id,
      startsAt: b.startsAt,
      partySize: b.partySize,
      occasion: b.occasion,
      guest: b.guest!,
    }));

  const todaysAllergies = todaysBookings
    .filter((b) => b.guest?.allergies && b.guest.allergies.trim().length > 0)
    .map((b) => ({
      bookingId: b.id,
      startsAt: b.startsAt,
      partySize: b.partySize,
      guestName: `${b.guest!.firstName}${b.guest!.lastName ? " " + b.guest!.lastName : ""}`,
      allergies: b.guest!.allergies!,
    }));

  return {
    birthdaysToday,
    birthdaysWeek: birthdaysWeek.slice(0, 12),
    atRisk: atRiskRows,
    vipsArrivingToday,
    recentReturning: recentReturningRows,
    todaysAllergies,
  };
}

function guestSummarySelect() {
  return {
    id: true,
    firstName: true,
    lastName: true,
    email: true,
    phone: true,
    loyaltyTier: true,
    totalVisits: true,
    lastVisitAt: true,
    marketingOptIn: true,
    birthday: true,
    allergies: true,
  } as const;
}
