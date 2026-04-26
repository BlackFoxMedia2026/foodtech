import { describe, expect, it } from "vitest";
import { parseDate, parseName, parseTime } from "@/server/chat";

describe("chat parsers", () => {
  it("parseTime handles hh:mm and hh.mm and bare hour", () => {
    expect(parseTime("alle 20:30")).toBe("20:30");
    expect(parseTime("alle 20.30")).toBe("20:30");
    expect(parseTime("alle 20")).toBe("20:00");
    expect(parseTime("ciao")).toBeNull();
  });

  it("parseDate handles relative italian words", () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    expect(parseDate("oggi alle 8")).toBe(`${yyyy}-${mm}-${dd}`);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tdd = String(tomorrow.getDate()).padStart(2, "0");
    const tmm = String(tomorrow.getMonth() + 1).padStart(2, "0");
    expect(parseDate("domani sera")).toBe(
      `${tomorrow.getFullYear()}-${tmm}-${tdd}`,
    );
  });

  it("parseDate handles iso and dd/mm formats", () => {
    expect(parseDate("vorrei il 2026-05-12")).toBe("2026-05-12");
    expect(parseDate("12/05/2026")).toBe("2026-05-12");
  });

  it("parseName extracts first and last", () => {
    expect(parseName("Mi chiamo Lucia Rossi")).toEqual({
      first: "Lucia",
      last: "Rossi",
    });
    expect(parseName("Sono Marco")).toEqual({ first: "Marco" });
    expect(parseName("12345")).toBeNull();
  });
});
