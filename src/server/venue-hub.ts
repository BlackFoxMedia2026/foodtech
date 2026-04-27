import { db } from "@/lib/db";

// One-shot aggregator for the public venue hub. Bundles brand, contacts,
// active gift card pool count (so we can advertise "regala un'esperienza"
// only when it's actually sellable), the venue's review platform links,
// the recent review snippet and a weekday-grouped service hours view.

export type VenueHub = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  kind: string;
  brand: {
    logoUrl: string | null;
    accent: string;
    footnote: string | null;
  };
  hasMenu: boolean;
  hasWifi: boolean;
  hasGiftCards: boolean;
  reviewSummary: { count: number; average: number };
  recentReviews: Array<{
    id: string;
    source: string;
    rating: number;
    authorName: string | null;
    text: string | null;
    publishedAt: Date | null;
  }>;
  reviewLinks: Array<{
    id: string;
    platform: string;
    label: string | null;
    url: string;
  }>;
  hours: Array<{ weekday: number; ranges: Array<{ from: string; to: string; name: string }> }>;
};

const DAY_LABELS = [
  "Domenica",
  "Lunedì",
  "Martedì",
  "Mercoledì",
  "Giovedì",
  "Venerdì",
  "Sabato",
];

export function dayLabel(weekday: number): string {
  return DAY_LABELS[weekday] ?? "—";
}

function formatHHMM(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export async function getVenueHub(slug: string): Promise<VenueHub | null> {
  const venue = await db.venue.findFirst({
    where: { slug, active: true },
    select: {
      id: true,
      name: true,
      slug: true,
      city: true,
      address: true,
      phone: true,
      email: true,
      kind: true,
      brandLogoUrl: true,
      brandAccent: true,
      brandFootnote: true,
      shifts: {
        where: { active: true },
        orderBy: [{ weekday: "asc" }, { startMinute: "asc" }],
        select: { weekday: true, startMinute: true, endMinute: true, name: true },
      },
      reviewLinks: {
        where: { active: true },
        orderBy: { ordering: "asc" },
        select: { id: true, platform: true, label: true, url: true },
      },
      _count: {
        select: {
          menuItems: { where: { available: true } },
          giftCards: { where: { status: "ACTIVE" } },
          wifiSessions: true,
        },
      },
    },
  });
  if (!venue) return null;

  const [reviewAgg, recent] = await Promise.all([
    db.review.aggregate({
      where: { venueId: venue.id },
      _count: { _all: true },
      _avg: { rating: true },
    }),
    db.review.findMany({
      where: { venueId: venue.id, text: { not: null } },
      orderBy: { publishedAt: "desc" },
      take: 3,
      select: {
        id: true,
        source: true,
        rating: true,
        authorName: true,
        text: true,
        publishedAt: true,
      },
    }),
  ]);

  // Group shifts by weekday
  const grouped = new Map<number, Array<{ from: string; to: string; name: string }>>();
  for (const s of venue.shifts) {
    if (!grouped.has(s.weekday)) grouped.set(s.weekday, []);
    grouped.get(s.weekday)!.push({
      from: formatHHMM(s.startMinute),
      to: formatHHMM(s.endMinute),
      name: s.name,
    });
  }
  const hours = [...grouped.entries()]
    .map(([weekday, ranges]) => ({ weekday, ranges }))
    .sort((a, b) => a.weekday - b.weekday);

  return {
    id: venue.id,
    name: venue.name,
    slug: venue.slug,
    city: venue.city,
    address: venue.address,
    phone: venue.phone,
    email: venue.email,
    kind: venue.kind,
    brand: {
      logoUrl: venue.brandLogoUrl,
      accent: venue.brandAccent ?? "#c9a25a",
      footnote: venue.brandFootnote,
    },
    hasMenu: venue._count.menuItems > 0,
    hasWifi: venue._count.wifiSessions > 0 || venue.shifts.length > 0,
    hasGiftCards: venue._count.giftCards > 0,
    reviewSummary: {
      count: reviewAgg._count._all,
      average: reviewAgg._avg.rating ?? 0,
    },
    recentReviews: recent,
    reviewLinks: venue.reviewLinks,
    hours,
  };
}
