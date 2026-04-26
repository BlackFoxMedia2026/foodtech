import { describe, expect, it } from "vitest";
import { TableOrderInput } from "@/server/table-orders";

describe("table-orders / TableOrderInput", () => {
  it("accepts a typical cart payload", () => {
    const parsed = TableOrderInput.parse({
      items: [
        { menuItemId: "abc", quantity: 1 },
        { menuItemId: "def", quantity: 2, notes: "ben cotto" },
      ],
      notes: "Senza glutine",
      customerName: "Lucia",
    });
    expect(parsed.items).toHaveLength(2);
  });

  it("rejects empty cart", () => {
    expect(() => TableOrderInput.parse({ items: [] })).toThrow();
  });

  it("rejects more than 40 items", () => {
    const items = Array.from({ length: 50 }, () => ({
      menuItemId: "x",
      quantity: 1,
    }));
    expect(() => TableOrderInput.parse({ items })).toThrow();
  });

  it("rejects quantity > 20", () => {
    expect(() =>
      TableOrderInput.parse({ items: [{ menuItemId: "x", quantity: 50 }] }),
    ).toThrow();
  });
});
