import { describe, expect, it } from "vitest";
import { ManualReviewInput, VenuePlaceInput } from "@/server/reviews";
import { isGooglePlacesEnabled } from "@/lib/google-places";

describe("reviews / ManualReviewInput", () => {
  it("accepts valid manual review payload", () => {
    const parsed = ManualReviewInput.parse({
      source: "TRIPADVISOR",
      rating: 5,
      authorName: "Marco",
      text: "Esperienza top",
      externalUrl: "https://www.tripadvisor.it/Review-foo",
    });
    expect(parsed.rating).toBe(5);
    expect(parsed.source).toBe("TRIPADVISOR");
  });

  it("rejects rating outside 1-5", () => {
    expect(() =>
      ManualReviewInput.parse({ source: "MANUAL", rating: 0 }),
    ).toThrow();
    expect(() =>
      ManualReviewInput.parse({ source: "MANUAL", rating: 6 }),
    ).toThrow();
  });

  it("rejects unknown source", () => {
    expect(() =>
      ManualReviewInput.parse({ source: "MARS", rating: 4 }),
    ).toThrow();
  });
});

describe("reviews / VenuePlaceInput", () => {
  it("accepts a typical place id", () => {
    const ok = VenuePlaceInput.parse({
      googlePlaceId: "ChIJN1t_tDeuEmsRUsoyG83frY4",
    });
    expect(ok.googlePlaceId).toBeTruthy();
  });

  it("rejects place ids with weird chars", () => {
    expect(() =>
      VenuePlaceInput.parse({ googlePlaceId: "<script>" }),
    ).toThrow();
  });
});

describe("reviews / isGooglePlacesEnabled", () => {
  it("reflects env state", () => {
    const original = process.env.GOOGLE_PLACES_API_KEY;
    delete process.env.GOOGLE_PLACES_API_KEY;
    expect(isGooglePlacesEnabled()).toBe(false);
    process.env.GOOGLE_PLACES_API_KEY = "test-key";
    expect(isGooglePlacesEnabled()).toBe(true);
    if (original === undefined) delete process.env.GOOGLE_PLACES_API_KEY;
    else process.env.GOOGLE_PLACES_API_KEY = original;
  });
});
