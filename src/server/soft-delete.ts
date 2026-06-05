/**
 * Soft-delete helpers for GDPR-critical entities.
 *
 * Una `db.venue.delete()` cascata cancellerebbe 3 anni di storico in millisecondi:
 * inaccettabile sotto GDPR art. 30 (registri delle attività di trattamento) e
 * art. 5(1)(f) (integrità/riservatezza). Per Booking, Payment, MessageLog e
 * CouponRedemption usiamo soft-delete + audit log, così l'admin può ancora
 * rispondere a richieste forensi e l'utente può recuperare entro 30 giorni.
 *
 * Strategia query:
 *   - non riscriviamo TUTTE le `findMany` esistenti (rischio rotture).
 *   - esponiamo `notDeleted` come spread di where filter da applicare sulle
 *     query HOT (sala / insights / analytics / risk / messaging).
 *   - le query admin/forensic possono leggere anche i record soft-deleted.
 *
 * `restore*` non è esposta per MessageLog/CouponRedemption: questi record
 * verranno spazzati da un auto-cleanup futuro (retention TTL).
 */

import { db } from "@/lib/db";
import { logAudit } from "@/server/audit";

/**
 * Filtro Prisma da fare spread nel `where` di una findMany/findFirst
 * per escludere i record soft-deleted.
 *
 * @example db.booking.findMany({ where: { venueId, ...notDeleted } })
 */
export const notDeleted = { deletedAt: null } as const;

/** Cache helper: risolve orgId dal venueId per logAudit. */
async function venueOrg(venueId: string): Promise<string | null> {
  const v = await db.venue.findUnique({
    where: { id: venueId },
    select: { orgId: true },
  });
  return v?.orgId ?? null;
}

export type SoftDeleteActor = {
  actorId?: string | null;
  actorEmail?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

// ─── Booking ─────────────────────────────────────────────────────────────────

export async function softDeleteBooking(
  venueId: string,
  id: string,
  actorId: string | null,
  meta: SoftDeleteActor = {},
) {
  const existing = await db.booking.findFirst({
    where: { id, venueId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) throw new Error("not_found");

  const updated = await db.booking.update({
    where: { id },
    data: { deletedAt: new Date(), deletedBy: actorId },
  });

  const orgId = await venueOrg(venueId);
  if (orgId) {
    await logAudit({
      orgId,
      venueId,
      actorId: actorId ?? meta.actorId ?? null,
      actorEmail: meta.actorEmail ?? null,
      action: "booking.softDelete",
      entityType: "Booking",
      entityId: id,
      diff: { deletedAt: { old: null, new: updated.deletedAt } },
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
    });
  }

  return updated;
}

export async function restoreBooking(
  venueId: string,
  id: string,
  actorId: string | null,
  meta: SoftDeleteActor = {},
) {
  const existing = await db.booking.findFirst({
    where: { id, venueId },
    select: { id: true, deletedAt: true },
  });
  if (!existing) throw new Error("not_found");
  if (!existing.deletedAt) throw new Error("not_deleted");

  const updated = await db.booking.update({
    where: { id },
    data: { deletedAt: null, deletedBy: null },
  });

  const orgId = await venueOrg(venueId);
  if (orgId) {
    await logAudit({
      orgId,
      venueId,
      actorId: actorId ?? meta.actorId ?? null,
      actorEmail: meta.actorEmail ?? null,
      action: "booking.restore",
      entityType: "Booking",
      entityId: id,
      diff: { deletedAt: { old: existing.deletedAt, new: null } },
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
    });
  }

  return updated;
}

// ─── Payment ─────────────────────────────────────────────────────────────────

export async function softDeletePayment(
  venueId: string,
  id: string,
  actorId: string | null,
  meta: SoftDeleteActor = {},
) {
  const existing = await db.payment.findFirst({
    where: { id, venueId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) throw new Error("not_found");

  const updated = await db.payment.update({
    where: { id },
    data: { deletedAt: new Date(), deletedBy: actorId },
  });

  const orgId = await venueOrg(venueId);
  if (orgId) {
    await logAudit({
      orgId,
      venueId,
      actorId: actorId ?? meta.actorId ?? null,
      actorEmail: meta.actorEmail ?? null,
      action: "payment.softDelete",
      entityType: "Payment",
      entityId: id,
      diff: { deletedAt: { old: null, new: updated.deletedAt } },
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
    });
  }

  return updated;
}

export async function restorePayment(
  venueId: string,
  id: string,
  actorId: string | null,
  meta: SoftDeleteActor = {},
) {
  const existing = await db.payment.findFirst({
    where: { id, venueId },
    select: { id: true, deletedAt: true },
  });
  if (!existing) throw new Error("not_found");
  if (!existing.deletedAt) throw new Error("not_deleted");

  const updated = await db.payment.update({
    where: { id },
    data: { deletedAt: null, deletedBy: null },
  });

  const orgId = await venueOrg(venueId);
  if (orgId) {
    await logAudit({
      orgId,
      venueId,
      actorId: actorId ?? meta.actorId ?? null,
      actorEmail: meta.actorEmail ?? null,
      action: "payment.restore",
      entityType: "Payment",
      entityId: id,
      diff: { deletedAt: { old: existing.deletedAt, new: null } },
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
    });
  }

  return updated;
}

// ─── MessageLog ──────────────────────────────────────────────────────────────
// Nessuna restore esposta: il record verrà auto-pulito dalla retention futura.

export async function softDeleteMessageLog(
  venueId: string,
  id: string,
  actorId: string | null,
  meta: SoftDeleteActor = {},
) {
  const existing = await db.messageLog.findFirst({
    where: { id, venueId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) throw new Error("not_found");

  const updated = await db.messageLog.update({
    where: { id },
    data: { deletedAt: new Date(), deletedBy: actorId },
  });

  const orgId = await venueOrg(venueId);
  if (orgId) {
    await logAudit({
      orgId,
      venueId,
      actorId: actorId ?? meta.actorId ?? null,
      actorEmail: meta.actorEmail ?? null,
      action: "messageLog.softDelete",
      entityType: "MessageLog",
      entityId: id,
      diff: { deletedAt: { old: null, new: updated.deletedAt } },
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
    });
  }

  return updated;
}

// ─── CouponRedemption ────────────────────────────────────────────────────────
// Nessuna restore esposta: il record verrà auto-pulito dalla retention futura.

export async function softDeleteCouponRedemption(
  venueId: string,
  id: string,
  actorId: string | null,
  meta: SoftDeleteActor = {},
) {
  const existing = await db.couponRedemption.findFirst({
    where: { id, venueId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) throw new Error("not_found");

  const updated = await db.couponRedemption.update({
    where: { id },
    data: { deletedAt: new Date(), deletedBy: actorId },
  });

  const orgId = await venueOrg(venueId);
  if (orgId) {
    await logAudit({
      orgId,
      venueId,
      actorId: actorId ?? meta.actorId ?? null,
      actorEmail: meta.actorEmail ?? null,
      action: "couponRedemption.softDelete",
      entityType: "CouponRedemption",
      entityId: id,
      diff: { deletedAt: { old: null, new: updated.deletedAt } },
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
    });
  }

  return updated;
}

/**
 * Finestra di restore per le prenotazioni: 30 giorni dalla soft-delete.
 * Usata dalla route POST /api/bookings/[id]/restore.
 */
export const BOOKING_RESTORE_WINDOW_DAYS = 30;

export function isWithinRestoreWindow(deletedAt: Date | null | undefined): boolean {
  if (!deletedAt) return false;
  const ms = Date.now() - new Date(deletedAt).getTime();
  return ms <= BOOKING_RESTORE_WINDOW_DAYS * 86400_000;
}
