import { z } from "zod";
import { db } from "@/lib/db";
import { fetchPlaceDetails, isGooglePlacesEnabled } from "@/lib/google-places";
import { captureError } from "@/lib/observability";

const SOURCES = [
  "GOOGLE",
  "TRIPADVISOR",
  "FACEBOOK",
  "YELP",
  "TRUSTPILOT",
  "MANUAL",
] as const;

export const ManualReviewInput = z.object({
  source: z.enum(SOURCES),
  rating: z.coerce.number().int().min(1).max(5),
  authorName: z.string().max(120).optional().nullable(),
  text: z.string().max(2000).optional().nullable(),
  externalUrl: z.string().url().max(400).optional().nullable(),
  publishedAt: z.coerce.date().optional().nullable(),
  language: z.string().max(5).optional(),
});

export const VenuePlaceInput = z.object({
  googlePlaceId: z
    .string()
    .max(120)
    .regex(/^[A-Za-z0-9_-]+$/)
    .optional()
    .nullable(),
});

export async function listReviews(venueId: string, limit = 50, source?: string) {
  return db.review.findMany({
    where: {
      venueId,
      ...(SOURCES.includes(source as never) ? { source: source as never } : {}),
    },
    orderBy: { publishedAt: { sort: "desc", nulls: "last" } },
    take: limit,
  });
}

export async function createManualReview(
  venueId: string,
  raw: unknown,
) {
  const data = ManualReviewInput.parse(raw);
  return db.review.create({
    data: {
      venueId,
      source: data.source,
      rating: data.rating,
      authorName: data.authorName ?? null,
      text: data.text ?? null,
      externalUrl: data.externalUrl ?? null,
      publishedAt: data.publishedAt ?? new Date(),
      language: data.language ?? "it",
      externalRef: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    },
  });
}

export async function deleteReview(venueId: string, id: string) {
  const existing = await db.review.findFirst({ where: { id, venueId } });
  if (!existing) throw new Error("not_found");
  await db.review.delete({ where: { id } });
}

export async function setVenuePlaceId(venueId: string, raw: unknown) {
  const data = VenuePlaceInput.parse(raw);
  return db.venue.update({
    where: { id: venueId },
    data: { googlePlaceId: data.googlePlaceId ?? null },
    select: { googlePlaceId: true },
  });
}

export async function syncGoogleReviews(venueId: string) {
  if (!isGooglePlacesEnabled()) {
    return { ok: false, reason: "no_api_key" as const, fetched: 0, inserted: 0 };
  }
  const venue = await db.venue.findUnique({
    where: { id: venueId },
    select: { googlePlaceId: true },
  });
  if (!venue?.googlePlaceId) {
    return { ok: false, reason: "no_place_id" as const, fetched: 0, inserted: 0 };
  }
  let details;
  try {
    details = await fetchPlaceDetails(venue.googlePlaceId);
  } catch (err) {
    captureError(err, { module: "reviews", venueId, extra: { stage: "fetch" } });
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "fetch_error",
      fetched: 0,
      inserted: 0,
    };
  }
  let inserted = 0;
  for (const r of details.reviews) {
    try {
      await db.review.upsert({
        where: {
          venueId_source_externalRef: {
            venueId,
            source: "GOOGLE",
            externalRef: r.externalRef,
          },
        },
        update: {
          rating: r.rating,
          authorName: r.authorName,
          authorAvatar: r.authorAvatar,
          text: r.text,
          language: r.language,
          publishedAt: r.publishedAt,
          externalUrl: r.externalUrl,
          fetchedAt: new Date(),
        },
        create: {
          venueId,
          source: "GOOGLE",
          externalRef: r.externalRef,
          externalUrl: r.externalUrl,
          rating: r.rating,
          authorName: r.authorName,
          authorAvatar: r.authorAvatar,
          text: r.text,
          language: r.language,
          publishedAt: r.publishedAt,
        },
      });
      inserted++;
    } catch (err) {
      captureError(err, {
        module: "reviews",
        venueId,
        extra: { stage: "upsert", externalRef: r.externalRef },
      });
    }
  }
  return {
    ok: true,
    reason: null,
    fetched: details.reviews.length,
    inserted,
    googleRating: details.rating,
    googleTotalRatings: details.totalRatings,
  };
}

export async function reviewStats(venueId: string) {
  const since = new Date();
  since.setDate(since.getDate() - 90);
  const [total, last90, agg, bySource] = await Promise.all([
    db.review.count({ where: { venueId } }),
    db.review.count({ where: { venueId, publishedAt: { gte: since } } }),
    db.review.aggregate({ where: { venueId }, _avg: { rating: true } }),
    db.review.groupBy({
      by: ["source"],
      where: { venueId },
      _count: { _all: true },
      _avg: { rating: true },
    }),
  ]);
  return {
    total,
    last90,
    avg: agg._avg.rating ?? 0,
    bySource: bySource.map((s) => ({
      source: s.source,
      count: s._count._all,
      avg: s._avg.rating ?? 0,
    })),
  };
}
