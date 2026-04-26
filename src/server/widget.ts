import { z } from "zod";
import { db } from "@/lib/db";
import { startOfDay, endOfDay } from "@/lib/utils";
import { sendEmail } from "@/lib/email";
import { renderGuestConfirmation, renderVenueNotification } from "@/emails/templates";
import { planDeposit, stripe } from "@/lib/stripe";
import { fireTrigger } from "@/server/automations";
import { buildManageLink } from "@/server/booking-self-service";

export const PublicBookingInput = z.object({
  partySize: z.coerce.number().int().min(1).max(20),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  firstName: z.string().min(1).max(60),
  lastName: z.string().max(60).optional().nullable(),
  email: z.string().email(),
  phone: z.string().min(5).max(30),
  occasion: z
    .enum(["BIRTHDAY", "ANNIVERSARY", "BUSINESS", "DATE", "CELEBRATION", "OTHER"])
    .optional()
    .nullable(),
  notes: z.string().max(500).optional().nullable(),
  marketingOptIn: z.coerce.boolean().optional(),
});

export type PublicBookingInputType = z.infer<typeof PublicBookingInput>;

export async function getPublicVenue(slug: string) {
  return db.venue.findFirst({
    where: { slug, active: true },
    select: {
      id: true,
      name: true,
      slug: true,
      kind: true,
      city: true,
      address: true,
      phone: true,
      email: true,
      coverImage: true,
      timezone: true,
      currency: true,
      depositThreshold: true,
      depositPerPersonCents: true,
    },
  });
}

const DEFAULT_DURATION_MIN = 105;

function minutesToHHMM(m: number) {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function hhmmToMinutes(s: string) {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}

export async function getAvailableSlots(
  venueId: string,
  dateISO: string,
  partySize: number,
) {
  const day = new Date(`${dateISO}T00:00:00`);
  if (Number.isNaN(day.getTime())) return [];
  const weekday = day.getDay();
  const today = startOfDay();
  if (day < today) return [];

  const shifts = await db.shift.findMany({
    where: { venueId, weekday, active: true },
    orderBy: { startMinute: "asc" },
  });
  if (shifts.length === 0) return [];

  const dayBookings = await db.booking.findMany({
    where: {
      venueId,
      startsAt: { gte: startOfDay(day), lte: endOfDay(day) },
      status: { in: ["CONFIRMED", "PENDING", "ARRIVED", "SEATED"] },
    },
    select: { startsAt: true, durationMin: true, partySize: true, tableId: true },
  });

  const blocks = await db.tableBlock.findMany({
    where: {
      venueId,
      startsAt: { lte: endOfDay(day) },
      endsAt: { gte: startOfDay(day) },
    },
    select: { startsAt: true, endsAt: true, tableId: true },
  });

  const tables = await db.table.findMany({
    where: { venueId, active: true },
    select: { id: true, seats: true },
  });
  const totalCapacity = tables.reduce((s, t) => s + t.seats, 0);

  const now = new Date();
  const slots: { time: string; available: boolean }[] = [];

  for (const shift of shifts) {
    const lastStart = shift.endMinute - DEFAULT_DURATION_MIN;
    for (let m = shift.startMinute; m <= Math.max(lastStart, shift.startMinute); m += shift.slotMinutes) {
      const slotStart = new Date(day);
      slotStart.setHours(0, m, 0, 0);
      if (slotStart < now) continue;
      const slotEnd = new Date(slotStart.getTime() + DEFAULT_DURATION_MIN * 60_000);

      const overlapping = dayBookings.filter((b) => {
        const bStart = b.startsAt.getTime();
        const bEnd = bStart + b.durationMin * 60_000;
        return bStart < slotEnd.getTime() && bEnd > slotStart.getTime();
      });

      const seatsBooked = overlapping.reduce((acc, b) => acc + b.partySize, 0);
      const shiftCapHit = overlapping.length >= shift.capacity;
      const seatsCapHit =
        totalCapacity > 0 && seatsBooked + partySize > Math.floor(totalCapacity * 0.9);

      // Filter tables blocked or booked during the slot to ensure at least one table fits the party
      const blockedTableIds = new Set(
        blocks
          .filter((b) => b.startsAt.getTime() < slotEnd.getTime() && b.endsAt.getTime() > slotStart.getTime())
          .map((b) => b.tableId),
      );
      const occupiedTableIds = new Set(
        overlapping
          .map((b) => b.tableId)
          .filter((id): id is string => Boolean(id)),
      );
      const fitsAtLeastOne = tables.some(
        (t) => !blockedTableIds.has(t.id) && !occupiedTableIds.has(t.id) && t.seats >= partySize,
      );

      slots.push({
        time: minutesToHHMM(m),
        available: !shiftCapHit && !seatsCapHit && fitsAtLeastOne,
      });
    }
  }

  const seen = new Set<string>();
  return slots.filter((s) => {
    if (seen.has(s.time)) return false;
    seen.add(s.time);
    return true;
  });
}

// Suggest the closest available time slots around the requested time across the
// next ±N days, used by the public widget when the chosen slot is unavailable.
export async function suggestAlternatives(
  venueId: string,
  dateISO: string,
  desiredTime: string,
  partySize: number,
  limit = 5,
) {
  const dayBase = new Date(`${dateISO}T00:00:00`);
  if (Number.isNaN(dayBase.getTime())) return [];
  const desiredMinutes = (() => {
    const [h, m] = desiredTime.split(":").map(Number);
    return h * 60 + m;
  })();

  const offsets = [0, 1, -1, 2, -2, 3, -3];
  const found: { date: string; time: string; distance: number }[] = [];

  for (const off of offsets) {
    if (found.length >= limit * 3) break;
    const d = new Date(dayBase);
    d.setDate(d.getDate() + off);
    if (d < startOfDay()) continue;
    const iso = d.toISOString().slice(0, 10);
    const slots = await getAvailableSlots(venueId, iso, partySize);
    for (const s of slots) {
      if (!s.available) continue;
      const [h, m] = s.time.split(":").map(Number);
      const slotMin = h * 60 + m;
      const distance = Math.abs(off) * 24 * 60 + Math.abs(slotMin - desiredMinutes);
      found.push({ date: iso, time: s.time, distance });
    }
  }

  return found
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit)
    .map(({ date, time }) => ({ date, time }));
}

export async function createPublicBooking(slug: string, raw: unknown) {
  const data = PublicBookingInput.parse(raw);
  const venue = await getPublicVenue(slug);
  if (!venue) throw new Error("venue_not_found");

  const startsAt = new Date(`${data.date}T${data.time}:00`);
  if (Number.isNaN(startsAt.getTime())) throw new Error("invalid_datetime");

  const slots = await getAvailableSlots(venue.id, data.date, data.partySize);
  const slot = slots.find((s) => s.time === data.time);
  if (!slot || !slot.available) throw new Error("slot_unavailable");

  const startMin = hhmmToMinutes(data.time);
  const weekday = startsAt.getDay();
  const shift = await db.shift.findFirst({
    where: {
      venueId: venue.id,
      weekday,
      active: true,
      startMinute: { lte: startMin },
      endMinute: { gte: startMin + DEFAULT_DURATION_MIN },
    },
  });
  if (!shift) throw new Error("outside_service");

  const existingGuest = await db.guest.findFirst({
    where: {
      venueId: venue.id,
      OR: [{ email: data.email }, { phone: data.phone }],
    },
  });

  const guest =
    existingGuest ??
    (await db.guest.create({
      data: {
        venueId: venue.id,
        firstName: data.firstName,
        lastName: data.lastName ?? null,
        email: data.email,
        phone: data.phone,
        marketingOptIn: data.marketingOptIn ?? false,
      },
    }));

  const deposit = planDeposit({
    partySize: data.partySize,
    threshold: venue.depositThreshold,
    perPersonCents: venue.depositPerPersonCents,
  });

  const booking = await db.booking.create({
    data: {
      venueId: venue.id,
      guestId: guest.id,
      partySize: data.partySize,
      startsAt,
      durationMin: DEFAULT_DURATION_MIN,
      status: "PENDING",
      source: "WIDGET",
      occasion: data.occasion ?? null,
      notes: data.notes ?? null,
      depositCents: deposit.required ? deposit.amountCents : 0,
      depositStatus: deposit.required ? "NONE" : "NONE",
    },
  });

  let checkoutUrl: string | null = null;
  if (deposit.required) {
    checkoutUrl = await createDepositCheckout({
      venue,
      guest: { email: guest.email, name: [guest.firstName, guest.lastName].filter(Boolean).join(" ") },
      booking,
      amountCents: deposit.amountCents,
    });
  }

  if (!deposit.required) {
    void notifyBookingCreated({ guest, venue, booking });
  }

  await fireTrigger("BOOKING_CREATED", {
    venueId: venue.id,
    guestId: guest.id,
    bookingId: booking.id,
    payload: { source: "WIDGET", partySize: data.partySize },
  }).catch(() => undefined);

  return { reference: booking.reference, venue, booking, checkoutUrl };
}

async function createDepositCheckout(opts: {
  venue: { id: string; name: string; slug: string; currency: string };
  guest: { email: string | null; name: string };
  booking: { id: string; reference: string; partySize: number; startsAt: Date };
  amountCents: number;
}) {
  const s = stripe();
  if (!s) return null;
  const baseUrl = process.env.NEXTAUTH_URL || `https://${process.env.VERCEL_URL || "localhost:3000"}`;
  try {
    const session = await s.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: opts.guest.email ?? undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: opts.venue.currency.toLowerCase(),
            unit_amount: opts.amountCents,
            product_data: {
              name: `Caparra prenotazione · ${opts.venue.name}`,
              description: `${opts.booking.partySize} persone · ${opts.booking.startsAt.toISOString()}`,
            },
          },
        },
      ],
      metadata: {
        bookingId: opts.booking.id,
        venueId: opts.venue.id,
        venueSlug: opts.venue.slug,
        reference: opts.booking.reference,
      },
      success_url: `${baseUrl}/b/${opts.venue.slug}/done?ref=${opts.booking.reference}&paid=1`,
      cancel_url: `${baseUrl}/b/${opts.venue.slug}/done?ref=${opts.booking.reference}&paid=0`,
    });

    await db.payment.create({
      data: {
        venueId: opts.venue.id,
        bookingId: opts.booking.id,
        amountCents: opts.amountCents,
        currency: opts.venue.currency,
        kind: "DEPOSIT",
        status: "PENDING",
        stripePaymentId: session.id,
      },
    });

    return session.url ?? null;
  } catch (err) {
    console.error("[stripe:checkout] failed", err);
    return null;
  }
}

async function notifyBookingCreated(opts: {
  guest: {
    firstName: string;
    lastName: string | null;
    email: string | null;
    language?: string | null;
  };
  venue: { name: string; email: string | null; city: string | null; address: string | null; phone: string | null };
  booking: { reference: string; partySize: number; startsAt: Date; occasion: string | null; notes: string | null };
}) {
  const { guest, venue, booking } = opts;

  const baseUrl =
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  const bookingWithLink = { ...booking, manageUrl: buildManageLink(baseUrl, booking.reference) };

  const tasks: Promise<unknown>[] = [];

  if (guest.email) {
    const tpl = renderGuestConfirmation({ guest, venue, booking: bookingWithLink });
    tasks.push(
      sendEmail({
        to: { email: guest.email, name: [guest.firstName, guest.lastName].filter(Boolean).join(" ") || undefined },
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
        replyTo: venue.email ?? undefined,
      }),
    );
  }

  if (venue.email) {
    const tpl = renderVenueNotification({ guest, venue, booking: bookingWithLink });
    tasks.push(
      sendEmail({
        to: { email: venue.email, name: venue.name },
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
        replyTo: guest.email ?? undefined,
      }),
    );
  }

  await Promise.allSettled(tasks);
}

export async function getBookingByReference(slug: string, reference: string) {
  const venue = await getPublicVenue(slug);
  if (!venue) return null;
  return db.booking.findFirst({
    where: { venueId: venue.id, reference },
    include: { guest: { select: { firstName: true, lastName: true, email: true } } },
  });
}
