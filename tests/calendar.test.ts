import { describe, expect, it } from "vitest";
import { renderCalendar, renderEvent } from "@/server/calendar";

describe("calendar / renderEvent", () => {
  it("emits a valid VEVENT block", () => {
    const event = renderEvent({
      uid: "abc",
      startsAt: new Date("2026-05-12T19:30:00Z"),
      durationMin: 90,
      summary: "Aurora Bistrot · 4 persone",
      description: "Allergico ai crostacei\nTavolo finestra",
      location: "Via dei Fiori 12, Milano",
      url: "https://example.com/r/booking/abc",
    });
    expect(event.startsWith("BEGIN:VEVENT")).toBe(true);
    expect(event.endsWith("END:VEVENT")).toBe(true);
    expect(event).toContain("UID:abc@tavolo");
    expect(event).toContain("DTSTART:20260512T193000Z");
    expect(event).toContain("DTEND:20260512T210000Z");
    expect(event).toContain("STATUS:CONFIRMED");
    expect(event).toContain("Aurora Bistrot");
    // commas/newlines escaped per RFC
    expect(event).toContain("Via dei Fiori 12\\, Milano");
    expect(event).toContain("Allergico ai crostacei\\n");
  });

  it("supports cancelled status", () => {
    const event = renderEvent({
      uid: "x",
      startsAt: new Date("2026-05-12T19:30:00Z"),
      durationMin: 60,
      summary: "Annullata",
      status: "CANCELLED",
    });
    expect(event).toContain("STATUS:CANCELLED");
  });
});

describe("calendar / renderCalendar", () => {
  it("wraps events in a VCALENDAR with metadata", () => {
    const ev = renderEvent({
      uid: "x",
      startsAt: new Date(),
      durationMin: 60,
      summary: "Test",
    });
    const cal = renderCalendar("Tavolo · Aurora", [ev]);
    expect(cal.startsWith("BEGIN:VCALENDAR")).toBe(true);
    expect(cal).toContain("X-WR-CALNAME:Tavolo · Aurora");
    expect(cal).toContain("PRODID:");
    expect(cal).toContain("VERSION:2.0");
    expect(cal).toContain("END:VCALENDAR");
  });
});
