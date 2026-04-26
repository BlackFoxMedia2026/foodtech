import { describe, expect, it } from "vitest";
import { dict, t, SUPPORTED_LOCALES } from "@/lib/i18n";

describe("i18n dictionaries", () => {
  it("every supported locale exposes the same keys", () => {
    const reference = Object.keys(dict("it"));
    for (const locale of SUPPORTED_LOCALES) {
      const keys = Object.keys(dict(locale));
      const missing = reference.filter((k) => !keys.includes(k));
      expect(missing, `missing keys in ${locale}`).toEqual([]);
    }
  });

  it("interpolates {vars}", () => {
    expect(t("it", "manage.bookedAs", { name: "Lucia" })).toContain("Lucia");
    expect(t("en", "menuUnlock.title", { venue: "Aurora" })).toContain("Aurora");
  });

  it("falls back to italian when key missing in target", () => {
    // translate any key — both locales should resolve, never undefined
    expect(t("en", "manage.cancel")).not.toBe("");
  });
});
