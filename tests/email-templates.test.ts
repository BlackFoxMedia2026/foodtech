import { describe, expect, it } from "vitest";
import {
  renderGuestConfirmation,
  renderReminder,
  renderVenueNotification,
} from "@/emails/templates";
import { renderSurveyEmail } from "@/server/surveys";

const venue = {
  name: "Aurora Bistrot",
  city: "Milano",
  address: "Via dei Fiori 12",
  phone: "+39 02 555 0101",
  email: "ciao@aurora.it",
};
const booking = {
  reference: "ref-1234abcd",
  partySize: 4,
  startsAt: new Date("2026-05-12T20:30:00.000Z"),
  occasion: "BIRTHDAY" as const,
  notes: null,
  manageUrl: "https://example.com/r/booking/ref-1234abcd",
};

describe("email templates / locale", () => {
  it("Italian guest gets Italian copy", () => {
    const t = renderGuestConfirmation({
      guest: { firstName: "Lucia", lastName: "Rossi", email: "lu@example.com", language: "it" },
      venue,
      booking,
    });
    expect(t.subject).toContain("Richiesta ricevuta");
    expect(t.html).toContain("Ci siamo quasi");
    expect(t.html).toContain("Gestisci la prenotazione");
    expect(t.html).toContain("Compleanno");
  });

  it("English guest gets English copy", () => {
    const t = renderGuestConfirmation({
      guest: { firstName: "Lucia", lastName: "Rossi", email: "lu@example.com", language: "en" },
      venue,
      booking,
    });
    expect(t.subject).toContain("Request received");
    expect(t.html).toContain("Almost there");
    expect(t.html).toContain("Manage booking");
    expect(t.html).toContain("Birthday");
  });

  it("Reminder respects guest language", () => {
    const it = renderReminder({
      guest: { firstName: "Marco", lastName: null, email: "m@e.it", language: "it" },
      venue,
      booking,
    });
    const en = renderReminder({
      guest: { firstName: "Marco", lastName: null, email: "m@e.it", language: "en" },
      venue,
      booking,
    });
    expect(it.subject).toContain("Promemoria");
    expect(en.subject).toContain("Reminder");
  });

  it("Venue notification respects guest language", () => {
    const en = renderVenueNotification({
      guest: { firstName: "Marco", lastName: "Conti", email: "m@e.it", language: "en" },
      venue,
      booking,
    });
    expect(en.html).toContain("New widget booking");
  });

  it("Survey email respects guest language", () => {
    const en = renderSurveyEmail({
      guestFirstName: "Marco",
      venueName: venue.name,
      link: "https://example.com/s/abc",
      language: "en",
    });
    expect(en.subject).toContain("how was it?");
    expect(en.html).toContain("Leave feedback");
  });
});
