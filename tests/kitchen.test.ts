import { describe, expect, it } from "vitest";
import { summariseTickets, type KitchenTicket } from "@/server/kitchen";

function ticket(over: Partial<KitchenTicket> = {}): KitchenTicket {
  return {
    id: "t1",
    source: "ORDER",
    reference: "AAAA1111",
    status: "RECEIVED",
    customerName: "Lucia",
    partyOrSize: 1,
    notes: null,
    scheduledAt: new Date("2026-05-12T20:00:00Z"),
    totalCents: 1000,
    currency: "EUR",
    items: [{ id: "i1", name: "Tartare", quantity: 1, notes: null }],
    pickupOrTable: "Ritiro",
    ...over,
  };
}

describe("kitchen / summariseTickets", () => {
  it("returns zero counts on empty input", () => {
    const s = summariseTickets([]);
    expect(s.total).toBe(0);
    expect(s.bySource.ORDER).toBe(0);
    expect(s.bySource.PREORDER).toBe(0);
    expect(s.earliestAt).toBeNull();
  });

  it("counts source and status correctly and surfaces the earliest schedule", () => {
    const s = summariseTickets([
      ticket({ id: "a", scheduledAt: new Date("2026-05-12T19:30:00Z") }),
      ticket({ id: "b", source: "PREORDER", status: "CONFIRMED" }),
      ticket({ id: "c", source: "PREORDER", status: "PREPARED" }),
      ticket({ id: "d", source: "ORDER", status: "PREPARING" }),
    ]);
    expect(s.total).toBe(4);
    expect(s.bySource.ORDER).toBe(2);
    expect(s.bySource.PREORDER).toBe(2);
    expect(s.byStatus.RECEIVED).toBe(1);
    expect(s.byStatus.PREPARING).toBe(1);
    expect(s.byStatus.CONFIRMED).toBe(1);
    expect(s.byStatus.PREPARED).toBe(1);
    expect(s.earliestAt?.toISOString()).toBe("2026-05-12T19:30:00.000Z");
  });
});
