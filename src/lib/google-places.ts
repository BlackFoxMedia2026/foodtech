// Thin client for the Google Places Details API. We pull just the data we
// need for the reviews aggregator: most recent reviews, overall rating,
// total ratings count. Falls back to a no-op when GOOGLE_PLACES_API_KEY is
// not set so the build keeps working without the integration enabled.

export type GoogleReview = {
  externalRef: string;
  authorName: string | null;
  authorAvatar: string | null;
  rating: number;
  text: string | null;
  language: string;
  publishedAt: Date | null;
  externalUrl: string | null;
};

export type GooglePlaceDetails = {
  rating: number | null;
  totalRatings: number | null;
  reviews: GoogleReview[];
};

export function isGooglePlacesEnabled() {
  return Boolean(process.env.GOOGLE_PLACES_API_KEY);
}

export async function fetchPlaceDetails(
  placeId: string,
): Promise<GooglePlaceDetails> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return { rating: null, totalRatings: null, reviews: [] };
  }
  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("fields", "rating,user_ratings_total,reviews,url");
  url.searchParams.set("language", "it");
  url.searchParams.set("reviews_sort", "newest");
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`google_places_${res.status}`);
  }
  const data = (await res.json()) as {
    status?: string;
    result?: {
      rating?: number;
      user_ratings_total?: number;
      url?: string;
      reviews?: Array<{
        author_name?: string;
        author_url?: string;
        profile_photo_url?: string;
        rating?: number;
        text?: string;
        relative_time_description?: string;
        time?: number;
        language?: string;
      }>;
    };
    error_message?: string;
  };

  if (data.status && data.status !== "OK") {
    throw new Error(`google_places_status_${data.status.toLowerCase()}`);
  }

  const result = data.result ?? {};
  const reviews: GoogleReview[] = (result.reviews ?? []).map((r, i) => ({
    externalRef: r.author_url
      ? hashAuthorUrl(r.author_url) + ":" + (r.time ?? i)
      : `g-${r.time ?? i}`,
    authorName: r.author_name ?? null,
    authorAvatar: r.profile_photo_url ?? null,
    rating: typeof r.rating === "number" ? r.rating : 0,
    text: r.text ?? null,
    language: r.language ?? "it",
    publishedAt: r.time ? new Date(r.time * 1000) : null,
    externalUrl: r.author_url ?? result.url ?? null,
  }));

  return {
    rating: typeof result.rating === "number" ? result.rating : null,
    totalRatings:
      typeof result.user_ratings_total === "number"
        ? result.user_ratings_total
        : null,
    reviews,
  };
}

function hashAuthorUrl(url: string): string {
  // Simple deterministic shortener (no crypto): we just need a stable id.
  let h = 0;
  for (let i = 0; i < url.length; i++) {
    h = (h * 31 + url.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}
