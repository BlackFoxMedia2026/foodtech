import type { Prisma, NotificationKind, StaffRole, OrgRole } from "@prisma/client";
import { db } from "@/lib/db";
import { captureError } from "@/lib/observability";

// In-app notifications. Fire-and-forget — every caller wraps the create()
// in a .catch() so a transient DB hiccup never breaks the actual flow
// (creating a booking, ingesting a sale, etc.).

export type NotifyInput = {
  venueId: string;
  kind: NotificationKind;
  title: string;
  body?: string | null;
  link?: string | null;
  meta?: Record<string, unknown> | null;
};

export async function notify(input: NotifyInput) {
  try {
    return await db.notification.create({
      data: {
        venueId: input.venueId,
        kind: input.kind,
        title: input.title.slice(0, 160),
        body: input.body?.slice(0, 500) ?? null,
        link: input.link?.slice(0, 300) ?? null,
        meta: (input.meta ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (err) {
    captureError(err, { module: "notifications", venueId: input.venueId });
    return null;
  }
}

// ─── Proactive push API (idempotent broadcast) ─────────────────────────────
//
// The Notification table is venue-scoped (no userId/role column), so the
// "audience" for a broadcast is implicit: every member of the venue sees
// every venue-level notification. `pushNotification()` accepts optional
// `userId`/`role` filters that we encode into `meta` so the UI/server can
// later filter ("show me notifications targeted at OWNER" etc.) without a
// schema migration.
//
// Idempotency: pass `sourceId` to dedupe — we'll skip the create if a
// notification with the same (venueId, kind, meta.sourceId) already exists.

export type PushNotificationInput = {
  venueId: string;
  kind: NotificationKind;
  title: string;
  body?: string | null;
  link?: string | null;
  // Restrict audience to a specific user OR to a role bucket. Stored in
  // meta — the bell still shows venue-wide notifications by default, but
  // the /notifications page can filter by these hints.
  userId?: string | null;
  role?: StaffRole | OrgRole | "ORG_OWNER" | null;
  // Idempotency token: same sourceId for the same (venueId, kind) = no dupe.
  sourceId?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function findNotificationBySource(
  venueId: string,
  kind: NotificationKind,
  sourceId: string,
) {
  return db.notification.findFirst({
    where: {
      venueId,
      kind,
      meta: { path: ["sourceId"], equals: sourceId },
    },
    select: { id: true, createdAt: true },
  });
}

export async function pushNotification(input: PushNotificationInput) {
  try {
    // Build the meta payload first — sourceId/audience get folded in.
    const meta: Record<string, unknown> = { ...(input.metadata ?? {}) };
    if (input.userId) meta.userId = input.userId;
    if (input.role) meta.role = input.role;
    if (input.sourceId) meta.sourceId = input.sourceId;

    if (input.sourceId) {
      const existing = await findNotificationBySource(
        input.venueId,
        input.kind,
        input.sourceId,
      );
      if (existing) return existing;
    }

    return await db.notification.create({
      data: {
        venueId: input.venueId,
        kind: input.kind,
        title: input.title.slice(0, 160),
        body: input.body?.slice(0, 500) ?? null,
        link: input.link?.slice(0, 300) ?? null,
        meta: meta as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    captureError(err, { module: "notifications:push", venueId: input.venueId });
    return null;
  }
}

// Convenience wrappers used by callers that read like the spec:
//   listNotificationsForUser(venueId, userId, { unreadOnly: true })
//   markNotificationsRead(venueId, userId, ids?)
export async function listNotificationsForUser(
  venueId: string,
  _userId: string,
  opts: { limit?: number; unreadOnly?: boolean } = {},
) {
  // The model is venue-wide today; the userId parameter is kept for forward
  // compatibility (when we wire per-user read receipts in a future schema).
  return listNotifications(venueId, opts);
}

export async function markNotificationsRead(
  venueId: string,
  _userId: string,
  ids?: string[],
) {
  if (!ids || ids.length === 0) {
    return markAllRead(venueId);
  }
  const res = await db.notification.updateMany({
    where: { id: { in: ids }, venueId, readAt: null },
    data: { readAt: new Date() },
  });
  return { updated: res.count };
}

export async function listNotifications(
  venueId: string,
  opts: { limit?: number; unreadOnly?: boolean } = {},
) {
  const limit = Math.min(opts.limit ?? 30, 100);
  return db.notification.findMany({
    where: {
      venueId,
      ...(opts.unreadOnly ? { readAt: null } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function unreadCount(venueId: string): Promise<number> {
  return db.notification.count({ where: { venueId, readAt: null } });
}

export async function markRead(venueId: string, id: string) {
  const existing = await db.notification.findFirst({ where: { id, venueId } });
  if (!existing) throw new Error("not_found");
  if (existing.readAt) return existing;
  return db.notification.update({
    where: { id },
    data: { readAt: new Date() },
  });
}

export async function markAllRead(venueId: string) {
  const result = await db.notification.updateMany({
    where: { venueId, readAt: null },
    data: { readAt: new Date() },
  });
  return { updated: result.count };
}

// Periodic prune so the table doesn't grow unbounded — anything older than
// 90 days that's been read for 30+ days is fair game.
export async function pruneOldNotifications() {
  const cutoff = new Date(Date.now() - 90 * 86400_000);
  const readCutoff = new Date(Date.now() - 30 * 86400_000);
  const result = await db.notification.deleteMany({
    where: {
      OR: [
        { createdAt: { lt: cutoff } },
        { AND: [{ readAt: { lt: readCutoff } }, { readAt: { not: null } }] },
      ],
    },
  });
  return { deleted: result.count };
}
