// CTR-weighted ranking for pre-order upsell suggestions.
//
// We mine `AuditLog` rows produced by `/api/preorders/[id]/upsell-suggestions`
// (action `preorder.upsell.shown`) and `/api/preorders/[id]/upsell-click`
// (action `preorder.upsell.clicked`) and compute, per `(reason, menuItemId)`
// pair, a "smoothed CTR" used to reorder suggestions.
//
// Smoothing: additive (Laplace-style) `(clicks + 1) / (shows + 5)`. The prior
// `1/5 = 20%` reflects the observed baseline conversion of curated concierge
// hints on similar food-tech preorder flows. With this prior:
//   - 0 shows / 0 clicks  → 0.20 (cold start, neutral)
//   - 1 show  / 1 click   → 0.33 (NOT 1.00 — a single hit is suggestive, not proof)
//   - 10 shows / 2 clicks → 0.20 (matches prior, no signal yet)
//   - 50 shows / 20 clicks → 0.38 (clear winner)
// This kills the "1 lucky click → forever top of list" trap.
//
// Caching: the query is O(events). On busy venues `upsell.shown` can fire on
// every preorder render. To avoid hammering the DB on every cart edit we
// memoize per-venue stats for 5 minutes in a module-level Map (no Redis).
// TTL is short enough that operators see ranking shifts within a single
// service, long enough to spare ~95% of the calls during a peak hour.

import { db } from "@/lib/db";

export type UpsellStats = {
  reason: string;
  menuItemId: string;
  showCount: number;
  clickCount: number;
  ctr: number;
  smoothedCtr: number;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { expiresAt: number; data: UpsellStats[] }>();

// Reset helper (used by tests / admin "ricalcola adesso" button if added later).
export function clearUpsellStatsCache(venueId?: string) {
  if (!venueId) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(`${venueId}:`)) cache.delete(key);
  }
}

function cacheKey(venueId: string, daysBack: number) {
  return `${venueId}:${daysBack}`;
}

// Extract { reason, menuItemId } pairs from a `diff` JSON payload.
// Two shapes are supported, matching the two endpoints:
//   - clicked: { reason: string, menuItemId: string }            -> 1 entry
//   - shown:   { hints: [{ reason, suggestedItemIds: string[] }] } -> N entries
function explodeDiff(
  diff: unknown,
): Array<{ reason: string; menuItemId: string }> {
  if (!diff || typeof diff !== "object") return [];
  const d = diff as Record<string, unknown>;

  // Per-item click event.
  if (typeof d.reason === "string" && typeof d.menuItemId === "string") {
    return [{ reason: d.reason, menuItemId: d.menuItemId }];
  }

  // Multi-hint shown event (new format).
  if (Array.isArray(d.hints)) {
    const out: Array<{ reason: string; menuItemId: string }> = [];
    for (const h of d.hints as unknown[]) {
      if (!h || typeof h !== "object") continue;
      const hint = h as Record<string, unknown>;
      const reason = typeof hint.reason === "string" ? hint.reason : null;
      const ids = Array.isArray(hint.suggestedItemIds)
        ? (hint.suggestedItemIds.filter((x) => typeof x === "string") as string[])
        : [];
      if (!reason) continue;
      for (const id of ids) out.push({ reason, menuItemId: id });
    }
    return out;
  }

  // Legacy shown event (pre-ranking) only carried `reasons: string[]` with no
  // item ids — we can't attribute it to a menuItem, so skip.
  return [];
}

export async function loadUpsellStats(
  venueId: string,
  daysBack = 60,
): Promise<UpsellStats[]> {
  const key = cacheKey(venueId, daysBack);
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) return cached.data;

  const since = new Date(now - daysBack * 86400_000);

  // We deliberately limit the projection: huge audit tables would otherwise
  // pull 500KB+ of unrelated user-agent/IP columns into memory.
  const rows = await db.auditLog.findMany({
    where: {
      venueId,
      action: { in: ["preorder.upsell.shown", "preorder.upsell.clicked"] },
      createdAt: { gte: since },
    },
    select: { action: true, diff: true },
  });

  const shows = new Map<string, number>();
  const clicks = new Map<string, number>();
  const seen = new Map<string, { reason: string; menuItemId: string }>();

  const bump = (
    bucket: Map<string, number>,
    reason: string,
    menuItemId: string,
  ) => {
    const k = `${reason}::${menuItemId}`;
    bucket.set(k, (bucket.get(k) ?? 0) + 1);
    if (!seen.has(k)) seen.set(k, { reason, menuItemId });
  };

  for (const row of rows) {
    const pairs = explodeDiff(row.diff);
    if (row.action === "preorder.upsell.shown") {
      for (const p of pairs) bump(shows, p.reason, p.menuItemId);
    } else {
      for (const p of pairs) bump(clicks, p.reason, p.menuItemId);
    }
  }

  const out: UpsellStats[] = [];
  for (const [k, { reason, menuItemId }] of seen.entries()) {
    const s = shows.get(k) ?? 0;
    const c = clicks.get(k) ?? 0;
    out.push({
      reason,
      menuItemId,
      showCount: s,
      clickCount: c,
      ctr: s === 0 ? 0 : c / s,
      // Laplace additive smoothing with baseline prior ~20% (1/5).
      smoothedCtr: (c + 1) / (s + 5),
    });
  }

  cache.set(key, { expiresAt: now + CACHE_TTL_MS, data: out });
  return out;
}

// Lightweight helper for callers that just want shown-count to gate cold-start.
export async function getShowCount(
  venueId: string,
  daysBack = 60,
): Promise<number> {
  const stats = await loadUpsellStats(venueId, daysBack);
  return stats.reduce((sum, s) => sum + s.showCount, 0);
}
