import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type AuditAction =
  | "guest.create"
  | "guest.update"
  | "guest.anonymize"
  | "guest.block"
  | "guest.unblock"
  | "payment.refund"
  | "coupon.create"
  | "coupon.update"
  | "coupon.delete"
  | "team.invite"
  | "team.role.change"
  | "team.remove"
  | "venue.create"
  | "venue.update"
  | "venue.delete"
  | "api_token.create"
  | "api_token.revoke"
  | "campaign.send"
  | "automation.run";

export type AuditLogInput = {
  orgId: string;
  venueId?: string | null;
  actorId?: string | null;
  actorEmail?: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  diff?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
};

/**
 * Append-only audit trail. Must never block the calling operation:
 * we swallow errors and only log them server-side. Use this from every
 * security-sensitive write path so GDPR right-to-know and accountability
 * requests have a single source of truth.
 */
export async function logAudit(input: AuditLogInput): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        orgId: input.orgId,
        venueId: input.venueId ?? null,
        actorId: input.actorId ?? null,
        actorEmail: input.actorEmail ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        diff: (input.diff ?? undefined) as Prisma.InputJsonValue | undefined,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  } catch (e) {
    // Audit log non deve mai bloccare l'operazione principale. Log silent.
    console.error("[audit] failed to log", e);
  }
}

// Campi sempre rimossi dal diff. `passwordHash` non è mai in input dei flussi
// audited, ma lo escludiamo per safety (defense in depth). `webhookSecret` e
// `hashedSecret` proteggono i token. `privateNotes` torna solo se il caller
// dichiara `viewerCanSeePrivate` (Manager).
const ALWAYS_SENSITIVE = new Set([
  "passwordHash",
  "webhookSecret",
  "hashedSecret",
  "secret",
  "stripeSecretKey",
]);

export type DiffEntry = { old: unknown; new: unknown };

/**
 * Confronta due snapshot di un'entità e restituisce solo i campi cambiati.
 * - Campi in `ALWAYS_SENSITIVE` (hash, segreti) sono sempre esclusi.
 * - `privateNotes` è incluso solo se `opts.viewerCanSeePrivate` è true.
 * - Date, oggetti e array sono confrontati via JSON stringify (sufficient per
 *   le entità Prisma che logghiamo).
 */
export function sanitizeDiff(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
  opts: { viewerCanSeePrivate?: boolean } = {},
): Record<string, DiffEntry> {
  const out: Record<string, DiffEntry> = {};
  const b = before ?? {};
  const a = after ?? {};
  const keys = new Set<string>([...Object.keys(b), ...Object.keys(a)]);
  for (const key of keys) {
    if (ALWAYS_SENSITIVE.has(key)) continue;
    if (key === "privateNotes" && !opts.viewerCanSeePrivate) continue;
    const oldVal = b[key];
    const newVal = a[key];
    if (!isEqual(oldVal, newVal)) {
      out[key] = { old: oldVal ?? null, new: newVal ?? null };
    }
  }
  return out;
}

function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a == null || b == null) return a === b;
  if (typeof a !== "object" || typeof b !== "object") return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/**
 * Helper di lettura per la pagina admin: ultimi N log dell'org, opzionalmente
 * filtrati per venue. Manteniamo `take` ragionevole per evitare bloat UI.
 */
export async function listAuditLogs(
  orgId: string,
  opts: { venueId?: string; take?: number } = {},
) {
  return db.auditLog.findMany({
    where: {
      orgId,
      ...(opts.venueId ? { venueId: opts.venueId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: opts.take ?? 100,
  });
}
