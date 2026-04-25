import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type SegmentKey =
  | "all"
  | "inactive_90d"
  | "top_spenders"
  | "birthdays_month"
  | "no_show_3"
  | "new_30d"
  | "regulars_5"
  | "vip"
  | "marketing_optin";

export const SEGMENT_DEFS: { key: SegmentKey; label: string; description: string }[] = [
  { key: "all", label: "Tutti", description: "Nessun filtro applicato" },
  { key: "vip", label: "VIP & Ambassador", description: "Ospiti del livello fedeltà più alto" },
  { key: "regulars_5", label: "Abituali", description: "Almeno 5 visite registrate" },
  { key: "new_30d", label: "Nuovi (30gg)", description: "Iscritti negli ultimi 30 giorni" },
  { key: "inactive_90d", label: "Inattivi (90gg)", description: "Non visitano da 90+ giorni" },
  { key: "top_spenders", label: "Top spender", description: "Spesa totale ≥ 500 €" },
  { key: "birthdays_month", label: "Compleanno mese", description: "Compleanno questo mese" },
  { key: "no_show_3", label: "No-show frequenti", description: "≥ 3 no-show storici" },
  { key: "marketing_optin", label: "Opt-in marketing", description: "Hanno acconsentito a comunicazioni" },
];

export function buildSegmentFilter(key: SegmentKey, opts: { now?: Date } = {}): Prisma.GuestWhereInput {
  const now = opts.now ?? new Date();
  switch (key) {
    case "vip":
      return { loyaltyTier: { in: ["VIP", "AMBASSADOR"] } };
    case "regulars_5":
      return { totalVisits: { gte: 5 } };
    case "new_30d": {
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - 30);
      return { createdAt: { gte: cutoff } };
    }
    case "inactive_90d": {
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - 90);
      return {
        OR: [
          { lastVisitAt: { lt: cutoff } },
          { AND: [{ lastVisitAt: null }, { totalVisits: { gt: 0 } }] },
        ],
      };
    }
    case "top_spenders":
      return { totalSpend: { gte: 500 } };
    case "birthdays_month":
      // Postgres: extract month
      return {} as Prisma.GuestWhereInput;
    case "no_show_3":
      return { noShowCount: { gte: 3 } };
    case "marketing_optin":
      return { marketingOptIn: true };
    case "all":
    default:
      return {};
  }
}

export async function listGuestsForSegment(venueId: string, key: SegmentKey, q?: string) {
  const base: Prisma.GuestWhereInput = { venueId, ...buildSegmentFilter(key) };
  if (q) {
    base.AND = [
      ...((base.AND as Prisma.GuestWhereInput[] | undefined) ?? []),
      {
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { phone: { contains: q } },
        ],
      },
    ];
  }
  let rows = await db.guest.findMany({
    where: base,
    orderBy: [{ loyaltyTier: "desc" }, { lastVisitAt: "desc" }, { createdAt: "desc" }],
    take: 500,
  });
  if (key === "birthdays_month") {
    const m = new Date().getMonth() + 1;
    rows = rows.filter((g) => g.birthday && new Date(g.birthday).getMonth() + 1 === m);
  }
  return rows;
}

export async function countSegments(venueId: string) {
  const counts: Partial<Record<SegmentKey, number>> = {};
  for (const def of SEGMENT_DEFS) {
    if (def.key === "birthdays_month") {
      const m = new Date().getMonth() + 1;
      const all = await db.guest.findMany({
        where: { venueId, birthday: { not: null } },
        select: { birthday: true },
      });
      counts[def.key] = all.filter((g) => g.birthday && new Date(g.birthday).getMonth() + 1 === m).length;
    } else {
      counts[def.key] = await db.guest.count({
        where: { venueId, ...buildSegmentFilter(def.key) },
      });
    }
  }
  return counts;
}
