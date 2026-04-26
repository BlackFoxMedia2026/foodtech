import { z } from "zod";
import { db } from "@/lib/db";

const PLATFORM = z.enum([
  "GOOGLE",
  "TRIPADVISOR",
  "TRUSTPILOT",
  "THEFORK",
  "FACEBOOK",
  "INSTAGRAM",
  "YELP",
  "OTHER",
]);

export const PLATFORM_LABEL: Record<string, string> = {
  GOOGLE: "Google",
  TRIPADVISOR: "TripAdvisor",
  TRUSTPILOT: "Trustpilot",
  THEFORK: "TheFork",
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  YELP: "Yelp",
  OTHER: "Altro",
};

export const ReviewLinkInput = z.object({
  platform: PLATFORM,
  url: z.string().url(),
  label: z.string().max(60).optional().nullable(),
  ordering: z.coerce.number().int().min(0).default(0),
  active: z.coerce.boolean().optional(),
});

export async function listReviewLinks(venueId: string, opts: { onlyActive?: boolean } = {}) {
  return db.reviewLink.findMany({
    where: { venueId, ...(opts.onlyActive ? { active: true } : {}) },
    orderBy: [{ ordering: "asc" }, { createdAt: "asc" }],
  });
}

export async function reviewLinkClickStats(venueId: string) {
  const links = await db.reviewLink.findMany({
    where: { venueId },
    include: { _count: { select: { clicks: true } } },
  });
  return links.map((l) => ({
    id: l.id,
    platform: l.platform,
    label: l.label,
    url: l.url,
    ordering: l.ordering,
    active: l.active,
    clicks: l._count.clicks,
  }));
}

export async function createReviewLink(venueId: string, raw: unknown) {
  const data = ReviewLinkInput.parse(raw);
  return db.reviewLink.create({
    data: {
      venueId,
      platform: data.platform,
      url: data.url,
      label: data.label ?? null,
      ordering: data.ordering,
      active: data.active ?? true,
    },
  });
}

export async function updateReviewLink(venueId: string, id: string, raw: unknown) {
  const existing = await db.reviewLink.findFirst({ where: { id, venueId } });
  if (!existing) throw new Error("not_found");
  const data = ReviewLinkInput.partial().parse(raw);
  return db.reviewLink.update({
    where: { id },
    data: {
      platform: data.platform ?? undefined,
      url: data.url ?? undefined,
      label: data.label === undefined ? undefined : data.label ?? null,
      ordering: data.ordering ?? undefined,
      active: data.active ?? undefined,
    },
  });
}

export async function deleteReviewLink(venueId: string, id: string) {
  const existing = await db.reviewLink.findFirst({ where: { id, venueId } });
  if (!existing) throw new Error("not_found");
  await db.reviewLink.delete({ where: { id } });
}

export async function trackReviewLinkClick(opts: {
  linkId: string;
  surveyId?: string | null;
  npsScore?: number | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const link = await db.reviewLink.findUnique({
    where: { id: opts.linkId },
    select: { id: true, venueId: true, url: true },
  });
  if (!link) return null;
  await db.reviewLinkClick.create({
    data: {
      linkId: link.id,
      venueId: link.venueId,
      surveyId: opts.surveyId ?? null,
      npsScore: opts.npsScore ?? null,
      ipAddress: opts.ipAddress ?? null,
      userAgent: opts.userAgent ?? null,
    },
  });
  return link;
}

export async function reputationStats(venueId: string) {
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const [allClicks, last30, byPlatform] = await Promise.all([
    db.reviewLinkClick.count({ where: { venueId } }),
    db.reviewLinkClick.count({ where: { venueId, createdAt: { gte: since } } }),
    db.reviewLinkClick.groupBy({
      by: ["linkId"],
      where: { venueId },
      _count: { _all: true },
    }),
  ]);
  return {
    totalClicks: allClicks,
    clicks30d: last30,
    byLink: byPlatform.map((g) => ({ linkId: g.linkId, clicks: g._count._all })),
  };
}
