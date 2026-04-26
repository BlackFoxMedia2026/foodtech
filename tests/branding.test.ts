import { describe, expect, it } from "vitest";
import { BrandInput, DEFAULT_ACCENT } from "@/server/branding";

describe("branding / BrandInput", () => {
  it("accepts a complete payload", () => {
    const parsed = BrandInput.parse({
      brandLogoUrl: "https://example.com/logo.png",
      brandAccent: "#1a73e8",
      brandFootnote: "Casa Aurora · dal 1996",
    });
    expect(parsed.brandAccent).toBe("#1a73e8");
  });

  it("accepts accent without leading hash", () => {
    const parsed = BrandInput.parse({ brandAccent: "fafafa" });
    expect(parsed.brandAccent).toBe("fafafa");
  });

  it("rejects invalid colors", () => {
    expect(() => BrandInput.parse({ brandAccent: "rgb(1,2,3)" })).toThrow();
  });

  it("rejects logo urls that aren't http(s)", () => {
    expect(() =>
      BrandInput.parse({ brandLogoUrl: "javascript:alert(1)" }),
    ).toThrow();
  });

  it("DEFAULT_ACCENT is a valid hex color", () => {
    expect(DEFAULT_ACCENT).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});
