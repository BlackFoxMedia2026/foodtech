import { z } from "zod";
import type { Booking } from "@prisma/client";
import { db } from "@/lib/db";
import { startOfDay, endOfDay } from "@/lib/utils";
import { fireTrigger } from "@/server/automations";
import { awardBookingPoints } from "@/server/loyalty";
import { offerNextWaitlistEntry } from "@/server/waitlist-promotion";
import { notDeleted, softDeleteBooking } from "@/server/soft-delete";

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
  combinedTableIds: z.array(z.string()).optional(),
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

const COMBINE_BUFFER_MIN = 15;
const ACTIVE_BOOKING_STATUSES = ["CONFIRMED", "PENDING", "ARRIVED", "SEATED"] as const;

/**
 * Restituisce tutti i tavoli (primario + combinati) di una booking.
 * Mantiene l'ordine: prima il primario, poi i combined.
 */
export async function tablesForBooking(
  booking: Pick<Booking, "tableId" | "combinedTableIds">,
) {
  const ids = [booking.tableId, ...(booking.combinedTableIds ?? [])].filter(
    Boolean,
  ) as string[];
  if (ids.length === 0) return [];
  return db.table.findMany({ where: { id: { in: ids } } });
}

/**
 * Verifica che ogni id appartenga al venue e abbia `combinable=true`.
 * Throws "table_not_combinable_<id>" o "table_not_in_venue_<id>".
 */
async function assertTablesCombinable(venueId: string, ids: string[]) {
  if (ids.length === 0) return;
  const found = await db.table.findMany({
    where: { id: { in: ids }, venueId },
    select: { id: true, combinable: true },
  });
  const byId = new Map(found.map((t) => [t.id, t]));
  for (const id of ids) {
    const t = byId.get(id);
    if (!t) throw new Error(`table_not_in_venue_${id}`);
    if (!t.combinable) throw new Error(`table_not_combinable_${id}`);
  }
}

/**
 * Controlla che ognuno dei tavoli combinati non sia già occupato in una
 * finestra `[startsAt - 15min, startsAt + durationMin + 15min]` da un'altra
 * booking attiva (esclude la booking corrente quando passata).
 * Throws "table_overlap_<tableId>".
 */
async function assertNoCombinedOverlap(
  venueId: string,
  combinedIds: string[],
  startsAt: Date,
  durationMin: number,
  excludeBookingId?: string,
) {
  if (combinedIds.length === 0) return;
  const windowStart = new Date(
    startsAt.getTime() - COMBINE_BUFFER_MIN * 60_000,
  );
  const windowEnd = new Date(
    startsAt.getTime() + (durationMin + COMBINE_BUFFER_MIN) * 60_000,
  );
  // Recupera prenotazioni attive nel venue che si sovrappongono al range
  // e che usano almeno uno dei tavoli (come primario o come combinato).
  const candidates = await db.booking.findMany({
    where: {
      venueId,
      ...notDeleted,
      id: excludeBookingId ? { not: excludeBookingId } : undefined,
      status: { in: [...ACTIVE_BOOKING_STATUSES] },
      startsAt: { lt: windowEnd },
      OR: [
        { tableId: { in: combinedIds } },
        { combinedTableIds: { hasSome: combinedIds } },
      ],
    },
    select: {
      id: true,
      tableId: true,
      combinedTableIds: true,
      startsAt: true,
      durationMin: true,
    },
  });
  for (const c of candidates) {
    const cStart = new Date(c.startsAt);
    const cEnd = new Date(
      cStart.getTime() + (c.durationMin + COMBINE_BUFFER_MIN) * 60_000,
    );
    const cStartBuffered = new Date(
      cStart.getTime() - COMBINE_BUFFER_MIN * 60_000,
    );
    // overlap classico [a1,a2) ∩ [b1,b2) non vuoto
    if (cEnd <= windowStart || cStartBuffered >= windowEnd) continue;
    const otherIds = [c.tableId, ...(c.combinedTableIds ?? [])].filter(
      Boolean,
    ) as string[];
    for (const tid of combinedIds) {
      if (otherIds.includes(tid)) {
        throw new Error(`table_overlap_${tid}`);
      }
    }
  }
}

export async function listBookings(venueId: string, opts: { from?: Date; to?: Date; status?: string } = {}) {
  return db.booking.findMany({
    where: {
      venueId,
      startsAt: opts.from || opts.to ? { gte: opts.from, lte: opts.to } : undefined,
      status: opts.status ? (opts.status as any) : undefined,
      ...notDeleted,
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

  // Combine tables: dedup, escludi il primario, valida combinabilità + overlap.
  const rawCombined = (data.combinedTableIds ?? []).filter(Boolean);
  const combinedTableIds = Array.from(new Set(rawCombined)).filter(
    (id) => id !== data.tableId,
  );
  if (combinedTableIds.length > 0) {
    if (!data.tableId) {
      // Senza tavolo primario non ha senso averne di combinati
      throw new Error("combined_requires_primary_table");
    }
    const allIds = [data.tableId, ...combinedTableIds];
    await assertTablesCombinable(venueId, allIds);
    await assertNoCombinedOverlap(
      venueId,
      combinedTableIds,
      data.startsAt,
      data.durationMin,
    );
  }

  const created = await db.booking.create({
    data: {
      venueId,
      guestId,
      tableId: data.tableId || null,
      combinedTableIds,
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

  // Decidi i tavoli finali da validare (se l'utente sta modificando
  // tableId/combinedTableIds/startsAt/durationMin).
  const nextTableId =
    data.tableId === undefined ? existing.tableId : data.tableId || null;
  const nextCombinedRaw =
    data.combinedTableIds === undefined
      ? existing.combinedTableIds
      : (data.combinedTableIds ?? []).filter(Boolean);
  const nextCombined = Array.from(new Set(nextCombinedRaw)).filter(
    (tid) => tid && tid !== nextTableId,
  );
  const nextStartsAt = data.startsAt ?? existing.startsAt;
  const nextDuration = data.durationMin ?? existing.durationMin;

  const combineTouched =
    data.combinedTableIds !== undefined ||
    data.tableId !== undefined ||
    data.startsAt !== undefined ||
    data.durationMin !== undefined;

  if (combineTouched && nextCombined.length > 0) {
    if (!nextTableId) throw new Error("combined_requires_primary_table");
    await assertTablesCombinable(venueId, [nextTableId, ...nextCombined]);
    await assertNoCombinedOverlap(
      venueId,
      nextCombined,
      nextStartsAt,
      nextDuration,
      id,
    );
  }

  const updated = await db.booking.update({
    where: { id },
    data: {
      partySize: data.partySize ?? undefined,
      startsAt: data.startsAt ?? undefined,
      durationMin: data.durationMin ?? undefined,
      tableId: data.tableId === undefined ? undefined : data.tableId,
      combinedTableIds:
        data.combinedTableIds === undefined ? undefined : nextCombined,
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

/**
 * GDPR-safe delete: NON cancella la riga, marca `deletedAt` + audit log.
 * Per il restore vedi `restoreBooking()` (entro 30gg, manager only).
 * Conserviamo la signature del legacy `deleteBooking()` per non rompere i
 * caller esistenti.
 */
export async function deleteBooking(venueId: string, id: string, actorId: string | null = null) {
  return softDeleteBooking(venueId, id, actorId);
}
