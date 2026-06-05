import { z } from "zod";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export const GuestInput = z.object({
  firstName: z.string().min(1),
  lastName: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal("")).optional().nullable(),
  phone: z.string().optional().nullable(),
  language: z.string().optional(),
  loyaltyTier: z.enum(["NEW", "REGULAR", "VIP", "AMBASSADOR"]).optional(),
  preferences: z.any().optional(),
  allergies: z.string().optional().nullable(),
  privateNotes: z.string().optional().nullable(),
  marketingOptIn: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});

export async function listGuests(venueId: string, q?: string) {
  const where: Prisma.GuestWhereInput = { venueId };
  if (q) {
    where.OR = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
    ];
  }
  return db.guest.findMany({
    where,
    orderBy: [{ loyaltyTier: "desc" }, { lastVisitAt: "desc" }, { createdAt: "desc" }],
    take: 200,
  });
}

export async function getGuest(venueId: string, id: string) {
  return db.guest.findFirst({
    where: { id, venueId },
    include: {
      bookings: {
        orderBy: { startsAt: "desc" },
        take: 30,
        include: { table: true },
      },
    },
  });
}

function normalizePhone(p?: string | null) {
  if (!p) return null;
  return p.replace(/[^\d+]/g, "");
}

function normalizeEmail(e?: string | null) {
  if (!e) return null;
  return e.trim().toLowerCase();
}

/**
 * Cerca duplicati nel venue per email/phone normalizzati. Restituisce il primo match,
 * o null. Usato sia da `createGuest` (auto-merge) sia dal nuovo endpoint /api/guests/find
 * per suggerimenti dedup nella UI.
 */
export async function findDuplicateGuest(
  venueId: string,
  raw: { email?: string | null; phone?: string | null },
) {
  const email = normalizeEmail(raw.email);
  const phone = normalizePhone(raw.phone);
  if (!email && !phone) return null;

  const or: Prisma.GuestWhereInput[] = [];
  if (email) or.push({ email: { equals: email, mode: "insensitive" } });
  if (phone) or.push({ phone });
  return db.guest.findFirst({
    where: { venueId, OR: or },
    include: {
      bookings: {
        orderBy: { startsAt: "desc" },
        take: 5,
        select: { id: true, startsAt: true, partySize: true, status: true },
      },
    },
  });
}

export async function createGuest(
  venueId: string,
  raw: unknown,
  opts: { skipDedupCheck?: boolean } = {},
) {
  const data = GuestInput.parse(raw);
  const email = normalizeEmail(data.email);
  const phone = normalizePhone(data.phone);

  // Auto-merge: se esiste già nello stesso venue (stesso email o phone), restituisco quello.
  // Eccezione: chiamante può forzare la creazione passando `skipDedupCheck`.
  if (!opts.skipDedupCheck) {
    const dup = await findDuplicateGuest(venueId, { email, phone });
    if (dup) return dup;
  }

  return db.guest.create({
    data: {
      venueId,
      firstName: data.firstName,
      lastName: data.lastName ?? null,
      email,
      phone,
      allergies: data.allergies ?? null,
      privateNotes: data.privateNotes ?? null,
      marketingOptIn: data.marketingOptIn ?? false,
      tags: data.tags ?? [],
      loyaltyTier: data.loyaltyTier ?? "NEW",
    },
  });
}

export async function updateGuest(venueId: string, id: string, raw: unknown) {
  const data = GuestInput.partial().parse(raw);
  const existing = await db.guest.findFirst({ where: { id, venueId } });
  if (!existing) throw new Error("not_found");
  return db.guest.update({ where: { id }, data });
}

/**
 * GDPR right-to-be-forgotten:
 * - PII (nome, cognome, email, telefono, compleanno, allergie, note) → anonimizzate
 * - Tag e preferenze → svuotate
 * - Marketing opt-in → revocato
 * - Storico booking/payment/order rimane (necessario per contabilità e prove fiscali)
 *   ma è ora collegato a un profilo anonimo (firstName = "Ospite anonimizzato")
 * - `anonymizedAt` + `anonymizedBy` registrano l'evento per audit
 *
 * L'operazione è IRREVERSIBILE.
 */
export async function anonymizeGuest(
  venueId: string,
  id: string,
  actorId: string,
) {
  const existing = await db.guest.findFirst({ where: { id, venueId } });
  if (!existing) throw new Error("not_found");
  if (existing.anonymizedAt) throw new Error("already_anonymized");

  return db.guest.update({
    where: { id },
    data: {
      firstName: "Ospite anonimizzato",
      lastName: null,
      email: null,
      phone: null,
      birthday: null,
      allergies: null,
      privateNotes: null,
      preferences: undefined,
      tags: [],
      marketingOptIn: false,
      anonymizedAt: new Date(),
      anonymizedBy: actorId,
    },
  });
}
