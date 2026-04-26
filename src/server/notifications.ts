import type { Prisma, NotificationKind } from "@prisma/client";
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
