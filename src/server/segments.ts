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
  | "marketing_optin"
  // Smart segments (computed, not pure SQL predicates)
  | "winback"
  | "champions"
  | "at_risk_loyal"
  | "high_value_silent";

export const SEGMENT_DEFS: { key: SegmentKey; label: string; description: string; smart?: boolean }[] = [
  { key: "all", label: "Tutti", description: "Nessun filtro applicato" },
  // Smart segments (gold star)
  {
    key: "champions",
    label: "★ Champions",
    description: "Frequenti, recenti, alto valore. I tuoi ospiti più preziosi.",
    smart: true,
  },
  {
    key: "winback",
    label: "★ Win-back",
    description: "Ospiti con buon storico ma silenzio da 60-180gg. Manda un coupon.",
    smart: true,
  },
  {
    key: "at_risk_loyal",
    label: "★ Loyal a rischio",
    description: "Visite >5 ma no-show recenti o cancellazioni multiple.",
    smart: true,
  },
  {
    key: "high_value_silent",
    label: "★ High-value silent",
    description: "Spesa media alta ma nessun contatto da 90gg. Riengagement priority.",
    smart: true,
  },
  // Standard
  { key: "vip", label: "VIP & Ambassador", description: "Ospiti del livello fedeltà più alto" },
  { key: "regulars_5", label: "Abituali", description: "Almeno 5 visite registrate" },
  { key: "new_30d", label: "Nuovi (30gg)", description: "Iscritti negli ultimi 30 giorni" },
  { key: "inactive_90d", label: "Inattivi (90gg)", description: "Non visitano da 90+ giorni" },
  { key: "top_spenders", label: "Top spender", description: "Spesa totale ≥ 500 €" },
  { key: "birthdays_month", label: "Compleanno mese", description: "Compleanno questo mese" },
  { key: "no_show_3", label: "No-show frequenti", description: "≥ 3 no-show storici" },
  { key: "marketing_optin", label: "Opt-in marketing", description: "Hanno acconsentito a comunicazioni" },
];

/**
 * Predicato Prisma "approssimato" per segmenti smart: filtra i candidati al
 * meglio possibile in SQL, poi `listGuestsForSegment` raffina in memoria con
 * regole più complesse (es. recency no-show, intervalli relativi).
 */
export function buildSegmentFilter(key: SegmentKey, opts: { now?: Date } = {}): Prisma.GuestWhereInput {
  const now = opts.now ?? new Date();
  switch (key) {
    // ── Smart segments ──────────────────────────────────────────────
    case "champions": {
      // visite >=8, ultima <30gg, spesa >300, no anonimizzati
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - 30);
      return {
        totalVisits: { gte: 8 },
        lastVisitAt: { gte: cutoff },
        totalSpend: { gte: 300 },
        anonymizedAt: null,
      };
    }
    case "winback": {
      // visite >=3, ultima fra 60 e 180gg fa, marketing opt-in true
      const recent = new Date(now);
      recent.setDate(recent.getDate() - 60);
      const old = new Date(now);
      old.setDate(old.getDate() - 180);
      return {
        totalVisits: { gte: 3 },
        lastVisitAt: { lt: recent, gte: old },
        marketingOptIn: true,
        anonymizedAt: null,
      };
    }
    case "at_risk_loyal":
      // visite >=5 ma no-show >=2 (refinement recency in memoria)
      return {
        totalVisits: { gte: 5 },
        noShowCount: { gte: 2 },
        anonymizedAt: null,
      };
    case "high_value_silent": {
      // spesa >500, ultima >=90gg fa
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - 90);
      return {
        totalSpend: { gte: 500 },
        OR: [{ lastVisitAt: { lt: cutoff } }, { lastVisitAt: null }],
        anonymizedAt: null,
      };
    }
    // ── Standard segments ───────────────────────────────────────────
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
