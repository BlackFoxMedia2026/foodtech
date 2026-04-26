import { describe, expect, it } from "vitest";
import {
  GiftCardInput,
  RedeemInput,
  normaliseCode,
  signGiftCardCode,
} from "@/server/gift-cards";

describe("gift-cards / GiftCardInput", () => {
  it("accepts a complete payload", () => {
    const parsed = GiftCardInput.parse({
      amount: 50,
      recipientName: "Lucia",
      recipientEmail: "lucia@example.com",
      senderName: "Marco",
      message: "Buon compleanno",
      expiresInDays: 365,
    });
    expect(parsed.amount).toBe(50);
    expect(parsed.expiresInDays).toBe(365);
  });

  it("rejects amounts under €5", () => {
    expect(() => GiftCardInput.parse({ amount: 1 })).toThrow();
  });

  it("RedeemInput validates code and amount", () => {
    expect(() => RedeemInput.parse({ code: "ab", amount: 1 })).toThrow();
    const ok = RedeemInput.parse({ code: "GIFT-ABCD-EFGH", amount: 12.5 });
    expect(ok.code).toBe("GIFT-ABCD-EFGH");
    expect(ok.amount).toBe(12.5);
  });
});

describe("gift-cards / normaliseCode", () => {
  it("uppercases and trims", () => {
    expect(normaliseCode("  gift-abcd-efgh  ")).toBe("GIFT-ABCD-EFGH");
  });
});

describe("gift-cards / signGiftCardCode", () => {
  it("returns a deterministic 16-char hex per code", () => {
    const a = signGiftCardCode("GIFT-AAAA-BBBB");
    const b = signGiftCardCode(" gift-aaaa-bbbb ");
    expect(a).toBe(b);
    expect(a).toHaveLength(16);
  });
});
