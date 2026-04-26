import { z } from "zod";
import { db } from "@/lib/db";
import { getAvailableSlots } from "@/server/widget";
import { fireTrigger } from "@/server/automations";

// Self-service booking management. The Booking.reference is already a cuid
// uniquely tied to the booking, so we use it as the magic-link token. This
// avoids extra schema (no separate Token row) and matches what the guest
// already gets by email.

export const ManageInput = z.object({
  partySize: z.coerce.number().int().min(1).max(20).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  notes: z.string().max(500).optional().nullable(),
});

export async function getBookingByReference(reference: string) {
  if (!reference || reference.length < 6) return null;
  return db.booking.findUnique({
    where: { reference },
    include: {
      guest: { select: { firstName: true, lastName: true, email: true } },
      venue: {
        select: {
          id: true,
          name: true,
          slug: true,
          city: true,
          address: true,
          phone: true,
          email: true,
          timezone: true,
          currency: true,
          brandLogoUrl: true,
          brandAccent: true,
        },
      },
    },
  });
}

const EDIT_LOCK_HOURS = 2;

function isLocked(startsAt: Date) {
  return startsAt.getTime() - Date.now() < EDIT_LOCK_HOURS * 60 * 60 * 1000;
}

const isClosed = (status: string) =>
  status === "COMPLETED" || status === "CANCELLED" || status === "NO_SHOW";

export async function updateBookingByReference(reference: string, raw: unknown) {
  const data = ManageInput.parse(raw);
  const booking = await db.booking.findUnique({
    where: { reference },
    include: { venue: { select: { id: true, slug: true, currency: true } } },
  });
  if (!booking) throw new Error("not_found");
  if (isClosed(booking.status)) throw new Error("locked");
  if (isLocked(booking.startsAt)) throw new Error("too_late");

  const targetDate = data.date ?? booking.startsAt.toISOString().slice(0, 10);
  const targetTime =
    data.time ??
    `${String(booking.startsAt.getHours()).padStart(2, "0")}:${String(booking.startsAt.getMinutes()).padStart(2, "0")}`;
  const targetParty = data.partySize ?? booking.partySize;

  // If date/time/party changed, validate the slot is still bookable.
  const dateChanged =
    data.date != null || data.time != null || data.partySize != null;
  if (dateChanged) {
    const startsAt = new Date(`${targetDate}T${targetTime}:00`);
    if (Number.isNaN(startsAt.getTime())) throw new Error("invalid_datetime");
    const slots = await getAvailableSlots(booking.venue.id, targetDate, targetParty);
    const slot = slots.find((s) => s.time === targetTime);
    // Allow keeping the same slot the booking already occupies even if it's
    // currently rendered as "unavailable" because of the booking itself.
    const isOwnSlot =
      booking.startsAt.toISOString().slice(0, 16) ===
      `${targetDate}T${targetTime}`;
    if (!isOwnSlot && (!slot || !slot.available)) throw new Error("slot_unavailable");

    const updated = await db.booking.update({
      where: { id: booking.id },
      data: {
        startsAt,
        partySize: targetParty,
        notes: data.notes === undefined ? undefined : data.notes ?? null,
      },
    });
    await db.bookingEvent.create({
      data: {
        bookingId: booking.id,
        kind: "TIME_CHANGED",
        message: `self-service: ${booking.startsAt.toISOString()} → ${startsAt.toISOString()} (${targetParty} pax)`,
      },
    });
    return updated;
  }

  if (data.notes !== undefined) {
    await db.booking.update({
      where: { id: booking.id },
      data: { notes: data.notes ?? null },
    });
    await db.bookingEvent.create({
      data: {
        bookingId: booking.id,
        kind: "NOTES_UPDATED",
        message: "self-service note update",
      },
    });
  }
  return db.booking.findUnique({ where: { id: booking.id } });
}

export async function cancelBookingByReference(reference: string, reason?: string) {
  const booking = await db.booking.findUnique({ where: { reference } });
  if (!booking) throw new Error("not_found");
  if (isClosed(booking.status)) throw new Error("already_closed");
  if (isLocked(booking.startsAt)) throw new Error("too_late");

  const updated = await db.booking.update({
    where: { id: booking.id },
    data: { status: "CANCELLED", closedAt: new Date() },
  });
  await db.bookingEvent.create({
    data: {
      bookingId: booking.id,
      kind: "CANCELLED",
      message: reason ? `self-service: ${reason.slice(0, 200)}` : "self-service cancellation",
    },
  });
  // Re-use the existing trigger so automations can react (e.g. follow-up
  // win-back email after a self-service cancellation).
  await fireTrigger("BOOKING_COMPLETED", {
    venueId: booking.venueId,
    guestId: booking.guestId ?? undefined,
    bookingId: booking.id,
    payload: { kind: "self-cancel" },
  }).catch(() => undefined);
  return updated;
}

export function buildManageLink(baseUrl: string, reference: string) {
  return `${baseUrl.replace(/\/$/, "")}/r/booking/${encodeURIComponent(reference)}`;
}
