import { describe, expect, it } from "vitest";
import { OFFER_TTL_MIN } from "@/server/waitlist-promotion";

describe("waitlist promotion", () => {
  it("OFFER_TTL_MIN is a sensible window", () => {
    // We rely on the cron expiring older offers; if someone bumps the
    // window without coordinating, the expiry sweep won't keep up.
    expect(OFFER_TTL_MIN).toBeGreaterThanOrEqual(5);
    expect(OFFER_TTL_MIN).toBeLessThanOrEqual(30);
  });
});
