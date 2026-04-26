import { describe, expect, it } from "vitest";
import { PreorderInput } from "@/server/preorders";

describe("preorders / PreorderInput", () => {
  it("accepts a complete payload", () => {
    const parsed = PreorderInput.parse({
      status: "CONFIRMED",
      notes: "Senza aglio",
      items: [
        { name: "Tartare", priceCents: 1500, quantity: 2 },
        { menuItemId: "m1", name: "Risotto", priceCents: 1800, quantity: 1, notes: "ben cotto" },
      ],
    });
    expect(parsed.items).toHaveLength(2);
    expect(parsed.status).toBe("CONFIRMED");
  });

  it("rejects items with negative price", () => {
    expect(() =>
      PreorderInput.parse({
        items: [{ name: "x", priceCents: -1, quantity: 1 }],
      }),
    ).toThrow();
  });

  it("rejects more than 50 items", () => {
    const items = Array.from({ length: 60 }, () => ({
      name: "x",
      priceCents: 100,
      quantity: 1,
    }));
    expect(() => PreorderInput.parse({ items })).toThrow();
  });
});
