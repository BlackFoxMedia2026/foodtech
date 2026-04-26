import crypto from "node:crypto";
import { db } from "@/lib/db";

// Self-contained iCalendar (RFC 5545) generator. We avoid pulling a
// dependency: the bookings model is small and the spec's surface we use
// here is tiny (VCALENDAR + VEVENT, with Europe/Rome timezone embedded).

const PRODID = "-//Tavolo//Hospitality SaaS//IT";

type EventInput = {
  uid: string;
  startsAt: Date;
  durationMin: number;
  summary: string;
  description?: string | null;
  location?: string | null;
  url?: string | null;
  status?: "CONFIRMED" | "TENTATIVE" | "CANCELLED";
};

export function renderEvent(e: EventInput): string {
  const dtstart = formatUtc(e.startsAt);
  const dtend = formatUtc(new Date(e.startsAt.getTime() + e.durationMin * 60_000));
  const status = e.status ?? "CONFIRMED";
  const lines = [
    "BEGIN:VEVENT",
    `UID:${escapeText(e.uid)}@tavolo`,
    `DTSTAMP:${formatUtc(new Date())}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${escapeText(e.summary)}`,
    e.description ? `DESCRIPTION:${escapeText(e.description)}` : "",
    e.location ? `LOCATION:${escapeText(e.location)}` : "",
    e.url ? `URL:${escapeText(e.url)}` : "",
    `STATUS:${status}`,
    "END:VEVENT",
  ].filter(Boolean);
  return lines.join("\r\n");
}

export function renderCalendar(name: string, events: string[]): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    `X-WR-CALNAME:${escapeText(name)}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
}

export async function bookingIcs(reference: string, baseUrl: string) {
  const booking = await db.booking.findUnique({
    where: { reference },
    include: {
      venue: {
        select: {
          name: true,
          slug: true,
          address: true,
          city: true,
          timezone: true,
        },
      },
      guest: { select: { firstName: true, lastName: true } },
    },
  });
  if (!booking) return null;
  if (
    booking.status === "CANCELLED" ||
    booking.status === "NO_SHOW"
  ) {
    return renderCalendar(`Tavolo · ${booking.venue.name}`, [
      renderEvent({
        uid: `booking-${booking.id}`,
        startsAt: booking.startsAt,
        durationMin: booking.durationMin,
        summary: `${booking.venue.name} · ${booking.partySize} persone`,
        status: "CANCELLED",
      }),
    ]);
  }
  const guestName = booking.guest
    ? `${booking.guest.firstName}${booking.guest.lastName ? " " + booking.guest.lastName : ""}`
    : null;
  const description = [
    `Codice prenotazione: ${booking.reference.slice(-8).toUpperCase()}`,
    booking.notes ? `Note: ${booking.notes}` : null,
    `Persone: ${booking.partySize}`,
    guestName ? `Ospite: ${guestName}` : null,
    `Gestisci: ${baseUrl.replace(/\/$/, "")}/r/booking/${booking.reference}`,
  ]
    .filter(Boolean)
    .join("\\n");
  const location = [booking.venue.address, booking.venue.city]
    .filter(Boolean)
    .join(", ");
  const event = renderEvent({
    uid: `booking-${booking.id}`,
    startsAt: booking.startsAt,
    durationMin: booking.durationMin,
    summary: `${booking.venue.name} · ${booking.partySize} persone`,
    description,
    location: location || null,
    url: `${baseUrl.replace(/\/$/, "")}/r/booking/${booking.reference}`,
  });
  return renderCalendar(`Tavolo · ${booking.venue.name}`, [event]);
}

export async function venueFeedIcs(slug: string, token: string, baseUrl: string) {
  const venue = await db.venue.findFirst({
    where: { slug, calendarToken: token, active: true },
    select: { id: true, name: true, slug: true },
  });
  if (!venue) return null;
  const sinceDays = 7;
  const aheadDays = 60;
  const bookings = await db.booking.findMany({
    where: {
      venueId: venue.id,
      startsAt: {
        gte: new Date(Date.now() - sinceDays * 86400_000),
        lte: new Date(Date.now() + aheadDays * 86400_000),
      },
    },
    include: {
      guest: { select: { firstName: true, lastName: true } },
      table: { select: { label: true } },
    },
    orderBy: { startsAt: "asc" },
    take: 1000,
  });
  const events = bookings.map((b) =>
    renderEvent({
      uid: `booking-${b.id}`,
      startsAt: b.startsAt,
      durationMin: b.durationMin,
      summary: `${b.partySize}p · ${
        b.guest ? `${b.guest.firstName}${b.guest.lastName ? " " + b.guest.lastName : ""}` : "Walk-in"
      }${b.table ? ` · ${b.table.label}` : ""}`,
      description: b.notes ?? null,
      status:
        b.status === "CANCELLED" || b.status === "NO_SHOW"
          ? "CANCELLED"
          : "CONFIRMED",
      url: `${baseUrl.replace(/\/$/, "")}/bookings/${b.id}`,
    }),
  );
  return renderCalendar(`Tavolo · ${venue.name} (sala)`, events);
}

export async function getOrCreateCalendarToken(venueId: string) {
  const venue = await db.venue.findUnique({
    where: { id: venueId },
    select: { calendarToken: true },
  });
  if (venue?.calendarToken) return venue.calendarToken;
  const token = crypto.randomBytes(18).toString("base64url");
  await db.venue.update({ where: { id: venueId }, data: { calendarToken: token } });
  return token;
}

export async function rotateCalendarToken(venueId: string) {
  const token = crypto.randomBytes(18).toString("base64url");
  await db.venue.update({ where: { id: venueId }, data: { calendarToken: token } });
  return token;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function formatUtc(d: Date) {
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function escapeText(s: string) {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}
