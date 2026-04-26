import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { posAdapterFor, verifyPosHmac } from "@/lib/pos";

describe("pos / verifyPosHmac", () => {
  it("matches a sha256 hex signature", () => {
    const body = JSON.stringify({ amount: 1234 });
    const secret = "topsecret";
    const sig = crypto.createHmac("sha256", secret).update(body).digest("hex");
    expect(verifyPosHmac(body, sig, secret)).toBe(true);
    expect(verifyPosHmac(body, `sha256=${sig}`, secret)).toBe(true);
  });

  it("rejects bad signatures", () => {
    expect(verifyPosHmac("body", "deadbeef", "secret")).toBe(false);
  });
});

describe("pos / parseWebhook", () => {
  it("normalises a Square-like sale payload", () => {
    const sale = posAdapterFor("SQUARE").parseWebhook({
      id: "ord-1",
      total_cents: 4500,
      currency: "EUR",
      customerName: "Lucia",
      bookingReference: "ref-abcd1234",
      items: [
        { name: "Tartare", price_cents: 1500, quantity: 1 },
        { name: "Vino", price_cents: 1500, quantity: 2 },
      ],
    });
    expect(sale).not.toBeNull();
    expect(sale!.totalCents).toBe(4500);
    expect(sale!.bookingReference).toBe("ref-abcd1234");
    expect(sale!.items).toHaveLength(2);
  });

  it("flags refunds correctly", () => {
    const sale = posAdapterFor("LIGHTSPEED").parseWebhook({
      id: "ord-2",
      amount: 1000,
      action: "sale.refunded",
    });
    expect(sale?.action).toBe("sale.refunded");
  });

  it("returns null when total is missing", () => {
    expect(posAdapterFor("CUSTOM").parseWebhook({ id: "x" })).toBeNull();
  });
});
