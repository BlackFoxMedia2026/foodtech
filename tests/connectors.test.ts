import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { adapterFor, verifyHmac } from "@/lib/connectors";

describe("connectors / verifyHmac", () => {
  it("matches a correct sha256 hex signature", () => {
    const body = JSON.stringify({ partySize: 4 });
    const secret = "topsecret";
    const sig = crypto.createHmac("sha256", secret).update(body).digest("hex");
    expect(verifyHmac(body, sig, secret)).toBe(true);
    expect(verifyHmac(body, `sha256=${sig}`, secret)).toBe(true);
  });

  it("rejects mismatched signatures", () => {
    expect(verifyHmac("body", "deadbeef", "secret")).toBe(false);
    expect(verifyHmac("body", "", "secret")).toBe(false);
  });
});

describe("connectors / parseWebhook", () => {
  it("parses a TheFork-style payload", () => {
    const adapter = adapterFor("THEFORK");
    const parsed = adapter.parseWebhook({
      id: "ext-42",
      partySize: 3,
      date: "2026-05-12",
      time: "20:30",
      firstName: "Anna",
      lastName: "Conti",
      email: "anna@example.com",
    });
    expect(parsed).not.toBeNull();
    expect(parsed!.partySize).toBe(3);
    expect(parsed!.externalId).toBe("ext-42");
    expect(parsed!.status).toBe("CONFIRMED");
  });

  it("returns null when essential fields are missing", () => {
    expect(adapterFor("CUSTOM").parseWebhook({ partySize: 3 })).toBeNull();
    expect(adapterFor("CUSTOM").parseWebhook("nope")).toBeNull();
  });

  it("flags cancelled bookings", () => {
    const parsed = adapterFor("BOOKING_COM").parseWebhook({
      id: "ext-1",
      partySize: 2,
      date: "2026-05-13",
      time: "13:00",
      firstName: "Marco",
      status: "CANCELLED",
    });
    expect(parsed?.status).toBe("CANCELLED");
  });
});
