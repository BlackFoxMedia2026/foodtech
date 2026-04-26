import { describe, expect, it } from "vitest";
import { ApiTokenInput, SCOPES } from "@/server/api-tokens";

describe("api-tokens / ApiTokenInput", () => {
  it("accepts a valid payload", () => {
    const parsed = ApiTokenInput.parse({
      name: "zapier-prod",
      scopes: ["bookings:read", "guests:read"],
      expiresInDays: 365,
    });
    expect(parsed.scopes).toHaveLength(2);
  });

  it("rejects unknown scopes", () => {
    expect(() =>
      ApiTokenInput.parse({ name: "bad", scopes: ["bookings:eat-data"] }),
    ).toThrow();
  });

  it("rejects empty scope list", () => {
    expect(() => ApiTokenInput.parse({ name: "x", scopes: [] })).toThrow();
  });

  it("SCOPES is non-empty and consistent", () => {
    expect(SCOPES.length).toBeGreaterThanOrEqual(5);
    expect(SCOPES).toContain("bookings:read");
  });
});
