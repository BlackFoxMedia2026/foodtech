import { describe, expect, it } from "vitest";
import { TRIGGERS, WorkflowInput } from "@/server/automations";

describe("automations WorkflowInput", () => {
  it("accepts a minimal valid workflow", () => {
    const parsed = WorkflowInput.parse({
      name: "Grazie post-visita",
      trigger: "BOOKING_COMPLETED",
      actions: [{ kind: "SEND_WHATSAPP", params: { body: "Grazie {{firstName}}" } }],
    });
    expect(parsed.actions).toHaveLength(1);
    expect(parsed.delayMinutes).toBe(0);
  });

  it("rejects a workflow without actions", () => {
    expect(() =>
      WorkflowInput.parse({
        name: "Mancano azioni",
        trigger: "BOOKING_CREATED",
        actions: [],
      }),
    ).toThrow();
  });

  it("rejects unknown triggers", () => {
    expect(() =>
      WorkflowInput.parse({
        name: "trigger sbagliato",
        trigger: "INVALID",
        actions: [{ kind: "ADD_GUEST_TAG", params: { tag: "vip" } }],
      }),
    ).toThrow();
  });

  it("exposes the canonical trigger list", () => {
    expect(TRIGGERS).toContain("NPS_DETRACTOR");
    expect(TRIGGERS).toContain("WIFI_LEAD_CREATED");
    expect(TRIGGERS).toContain("ORDER_COMPLETED");
  });

  it("caps actions at 5", () => {
    const tooMany = Array.from({ length: 6 }).map(() => ({
      kind: "ADD_GUEST_TAG" as const,
      params: { tag: "vip" },
    }));
    expect(() =>
      WorkflowInput.parse({
        name: "troppe",
        trigger: "BOOKING_CREATED",
        actions: tooMany,
      }),
    ).toThrow();
  });
});
