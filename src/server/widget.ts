import { z } from "zod";
import { db } from "@/lib/db";
import { startOfDay, endOfDay } from "@/lib/utils";

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
    select: { startsAt: true, durationMin: true, partySize: true },
  });

  const tableSeats = await db.table.aggregate({
    where: { venueId, active: true },
    _sum: { seats: true },
  });
  const totalCapacity = tableSeats._sum.seats ?? 0;

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

      slots.push({
        time: minutesToHHMM(m),
        available: !shiftCapHit && !seatsCapHit,
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
    },
  });

  return { reference: booking.reference, venue, booking };
}

export async function getBookingByReference(slug: string, reference: string) {
  const venue = await getPublicVenue(slug);
  if (!venue) return null;
  return db.booking.findFirst({
    where: { venueId: venue.id, reference },
    include: { guest: { select: { firstName: true, lastName: true, email: true } } },
  });
}
