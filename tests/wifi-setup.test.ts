import { describe, expect, it } from "vitest";
import { routerSnippets, WifiSetupInput } from "@/server/wifi-setup";

describe("wifi-setup / WifiSetupInput", () => {
  it("accepts a fully populated payload", () => {
    const parsed = WifiSetupInput.parse({
      portalLogoUrl: "https://example.com/logo.png",
      portalAccent: "#c9a25a",
      portalWelcome: "Connettiti",
      portalLegal: "GDPR…",
      autoCouponEnabled: true,
      autoCouponPercent: 15,
      autoCouponDays: 30,
      markComplete: true,
    });
    expect(parsed.portalAccent).toBe("#c9a25a");
    expect(parsed.markComplete).toBe(true);
  });

  it("normalises accent without # too", () => {
    const parsed = WifiSetupInput.parse({ portalAccent: "fafafa" });
    expect(parsed.portalAccent).toBe("fafafa");
  });

  it("rejects out-of-range coupon percent", () => {
    expect(() => WifiSetupInput.parse({ autoCouponPercent: 0 })).toThrow();
    expect(() => WifiSetupInput.parse({ autoCouponPercent: 200 })).toThrow();
  });
});

describe("wifi-setup / routerSnippets", () => {
  it("produces snippets for the supported controllers", () => {
    const snippets = routerSnippets("https://app.example.com/wifi/test/");
    const kinds = snippets.map((s) => s.kind);
    expect(kinds).toEqual(["unifi", "mikrotik", "openwrt", "qr"]);
    for (const s of snippets) {
      expect(s.code).toContain("app.example.com/wifi/test");
    }
  });
});
