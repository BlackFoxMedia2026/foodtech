import { describe, expect, it } from "vitest";
import { detectMenuMode } from "@/server/menu-leadmagnet";
import { buildManageLink } from "@/server/booking-self-service";

describe("detectMenuMode", () => {
  it("defaults to PUBLIC", () => {
    expect(detectMenuMode({} as NodeJS.ProcessEnv)).toBe("PUBLIC");
  });
  it("respects CONTACT", () => {
    expect(
      detectMenuMode({ MENU_LEAD_MAGNET_MODE: "contact" } as unknown as NodeJS.ProcessEnv),
    ).toBe("CONTACT");
  });
  it("respects OPT_IN", () => {
    expect(
      detectMenuMode({ MENU_LEAD_MAGNET_MODE: "OPT_IN" } as unknown as NodeJS.ProcessEnv),
    ).toBe("OPT_IN");
  });
  it("falls back on unknown values", () => {
    expect(
      detectMenuMode({ MENU_LEAD_MAGNET_MODE: "weird" } as unknown as NodeJS.ProcessEnv),
    ).toBe("PUBLIC");
  });
});

describe("buildManageLink", () => {
  it("encodes the reference and trims trailing slash", () => {
    expect(buildManageLink("https://app.example.com/", "abc123")).toBe(
      "https://app.example.com/r/booking/abc123",
    );
    expect(buildManageLink("https://app.example.com", "weird ref/with slash")).toBe(
      "https://app.example.com/r/booking/weird%20ref%2Fwith%20slash",
    );
  });
});
