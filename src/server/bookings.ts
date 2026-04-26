import { z } from "zod";
import { db } from "@/lib/db";
import { startOfDay, endOfDay } from "@/lib/utils";
import { fireTrigger } from "@/server/automations";
import { awardBookingPoints } from "@/server/loyalty";
import { offerNextWaitlistEntry } from "@/server/waitlist-promotion";

const BLACKLIST_NO_SHOW_THRESHOLD = 2;

export const BookingInput = z.object({
  guestId: z.string().optional().nullable(),
  guest: z
    .object({
      firstName: z.string().min(1),
      lastName: z.string().optional().nullable(),
      email: z.string().email().optional().nullable(),
      phone: z.string().optional().nullable(),
    })
    .optional(),
  partySize: z.coerce.number().int().min(1).max(50),
  startsAt: z.coerce.date(),
  durationMin: z.coerce.number().int().min(15).max(480).default(105),
  tableId: z.string().optional().nullable(),
  status: z
    .enum(["CONFIRMED", "PENDING", "ARRIVED", "SEATED", "COMPLETED", "CANCELLED", "NO_SHOW"])
    .default("CONFIRMED"),
  source: z.enum(["WIDGET", "PHONE", "WALK_IN", "GOOGLE", "SOCIAL", "CONCIERGE", "EVENT"]).default("PHONE"),
  occasion: z.enum(["BIRTHDAY", "ANNIVERSARY", "BUSINESS", "DATE", "CELEBRATION", "OTHER"]).optional().nullable(),
  notes: z.string().optional().nullable(),
  internalNotes: z.string().optional().nullable(),
  depositCents: z.coerce.number().int().nonnegative().default(0),
});

export type BookingInputType = z.infer<typeof BookingInput>;

export async function listBookings(venueId: string, opts: { from?: Date; to?: Date; status?: string } = {}) {
  return db.booking.findMany({
    where: {
      venueId,
      startsAt: opts.from || opts.to ? { gte: opts.from, lte: opts.to } : undefined,
      status: opts.status ? (opts.status as any) : undefined,
    },
    include: { guest: true, table: true },
    orderBy: { startsAt: "asc" },
    take: 200,
  });
}

export async function listBookingsForDay(venueId: string, day: Date) {
  return listBookings(venueId, { from: startOfDay(day), to: endOfDay(day) });
}

export async function createBooking(venueId: string, raw: unknown, opts?: { actorId?: string }) {
  const data = BookingInput.parse(raw);

  let guestId = data.guestId ?? null;
  if (!guestId && data.guest?.firstName) {
    const created = await db.guest.create({
      data: {
        venueId,
        firstName: data.guest.firstName,
        lastName: data.guest.lastName ?? null,
        email: data.guest.email ?? null,
        phone: data.guest.phone ?? null,
      },
    });
    guestId = created.id;
  }

  const created = await db.booking.create({
    data: {
      venueId,
      guestId,
      tableId: data.tableId || null,
      partySize: data.partySize,
      startsAt: data.startsAt,
      durationMin: data.durationMin,
      status: data.status,
      source: data.source,
      occasion: data.occasion ?? null,
      notes: data.notes ?? null,
      internalNotes: data.internalNotes ?? null,
      depositCents: data.depositCents,
    },
    include: { guest: true, table: true },
  });

  await db.bookingEvent.create({
    data: {
      bookingId: created.id,
      kind: "CREATED",
      message: `Prenotazione creata via ${data.source}`,
      actorId: opts?.actorId ?? null,
    },
  });

  await fireTrigger("BOOKING_CREATED", {
    venueId,
    guestId: guestId ?? undefined,
    bookingId: created.id,
    payload: { partySize: data.partySize, source: data.source },
  }).catch(() => undefined);

  return created;
}

export async function updateBooking(venueId: string, id: string, raw: unknown, opts?: { actorId?: string }) {
  const data = BookingInput.partial().parse(raw);
  const existing = await db.booking.findFirst({ where: { id, venueId } });
  if (!existing) throw new Error("not_found");

  const updated = await db.booking.update({
    where: { id },
    data: {
      partySize: data.partySize ?? undefined,
      startsAt: data.startsAt ?? undefined,
      durationMin: data.durationMin ?? undefined,
      tableId: data.tableId === undefined ? undefined : data.tableId,
      status: data.status ?? undefined,
      source: data.source ?? undefined,
      occasion: data.occasion ?? undefined,
      notes: data.notes ?? undefined,
      internalNotes: data.internalNotes ?? undefined,
      arrivedAt: data.status === "ARRIVED" ? new Date() : undefined,
      seatedAt: data.status === "SEATED" ? new Date() : undefined,
      closedAt:
        data.status === "COMPLETED" || data.status === "NO_SHOW" || data.status === "CANCELLED"
          ? new Date()
          : undefined,
    },
    include: { guest: true, table: true },
  });

  const events: { kind: "STATUS_CHANGED" | "TABLE_CHANGED" | "TIME_CHANGED" | "PARTY_CHANGED" | "NOTES_UPDATED"; message: string }[] = [];
  if (data.status !== undefined && data.status !== existing.status) {
    events.push({ kind: "STATUS_CHANGED", message: `${existing.status} → ${data.status}` });
  }
  if (data.tableId !== undefined && (data.tableId ?? null) !== existing.tableId) {
    events.push({ kind: "TABLE_CHANGED", message: data.tableId ? `Tavolo assegnato` : `Tavolo rimosso` });
  }
  if (data.startsAt !== undefined && data.startsAt.getTime() !== existing.startsAt.getTime()) {
    events.push({ kind: "TIME_CHANGED", message: `${existing.startsAt.toISOString()} → ${data.startsAt.toISOString()}` });
  }
  if (data.partySize !== undefined && data.partySize !== existing.partySize) {
    events.push({ kind: "PARTY_CHANGED", message: `${existing.partySize} → ${data.partySize}` });
  }
  if (data.notes !== undefined && (data.notes ?? null) !== existing.notes) {
    events.push({ kind: "NOTES_UPDATED", message: "Note aggiornate" });
  }
  if (events.length) {
    await db.bookingEvent.createMany({
      data: events.map((e) => ({ ...e, bookingId: id, actorId: opts?.actorId ?? null })),
    });
  }

  if (data.status === "COMPLETED" && existing.status !== "COMPLETED") {
    if (existing.guestId) {
      await awardBookingPoints({
        venueId,
        guestId: existing.guestId,
        bookingId: id,
        partySize: existing.partySize,
      }).catch(() => undefined);
      await db.guest
        .update({
          where: { id: existing.guestId },
          data: {
            totalVisits: { increment: 1 },
            lastVisitAt: new Date(),
          },
        })
        .catch(() => undefined);
    }
    await fireTrigger("BOOKING_COMPLETED", {
      venueId,
      guestId: existing.guestId ?? undefined,
      bookingId: id,
    }).catch(() => undefined);
  }

  if (
    data.status === "NO_SHOW" &&
    existing.status !== "NO_SHOW" &&
    existing.guestId
  ) {
    await flagNoShow(existing.guestId);
  }

  // A table just opened up — offer it to the next waitlist candidate.
  if (
    (data.status === "CANCELLED" ||
      data.status === "NO_SHOW" ||
      data.status === "COMPLETED") &&
    existing.status !== data.status
  ) {
    await offerNextWaitlistEntry({
      venueId,
      partySize: existing.partySize,
    }).catch(() => undefined);
  }

  return updated;
}

async function flagNoShow(guestId: string) {
  const guest = await db.guest.update({
    where: { id: guestId },
    data: { noShowCount: { increment: 1 } },
    select: { id: true, noShowCount: true, blocked: true },
  });
  if (!guest.blocked && guest.noShowCount >= BLACKLIST_NO_SHOW_THRESHOLD) {
    await db.guest.update({
      where: { id: guest.id },
      data: {
        blocked: true,
        blockedAt: new Date(),
        blockedReason: `Auto: ${guest.noShowCount} no-show consecutivi.`,
      },
    });
  }
}

export async function deleteBooking(venueId: string, id: string) {
  const existing = await db.booking.findFirst({ where: { id, venueId } });
  if (!existing) throw new Error("not_found");
  return db.booking.delete({ where: { id } });
}
