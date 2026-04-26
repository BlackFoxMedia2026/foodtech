// Lightweight in-memory rate limiter. Suitable for low-volume public APIs:
// captive portal, chat, menu scan, booking self-service. The serverless
// runtime gives each instance its own bucket, which is acceptable for this
// kind of soft throttling — the goal is to slow abuse, not to enforce a
// strict global SLA. For production-grade quotas swap with Upstash/Redis.

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export type RateLimitOptions = {
  key?: string;
  max?: number;          // requests allowed per window
  windowMs?: number;     // window size
};

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetAt: number;
};

export function rateLimit(req: Request, opts: RateLimitOptions = {}): RateLimitResult {
  const max = opts.max ?? 30;
  const windowMs = opts.windowMs ?? 60_000;
  const id = identify(req, opts.key);
  const now = Date.now();
  const bucket = buckets.get(id);

  if (!bucket || bucket.resetAt < now) {
    const fresh = { count: 1, resetAt: now + windowMs };
    buckets.set(id, fresh);
    pruneIfHot();
    return { ok: true, remaining: max - 1, resetAt: fresh.resetAt };
  }

  bucket.count++;
  if (bucket.count > max) {
    return { ok: false, remaining: 0, resetAt: bucket.resetAt };
  }
  return { ok: true, remaining: max - bucket.count, resetAt: bucket.resetAt };
}

function identify(req: Request, key?: string) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "anon";
  return key ? `${key}|${ip}` : ip;
}

function pruneIfHot() {
  if (buckets.size < 2_000) return;
  const now = Date.now();
  for (const [k, v] of buckets) {
    if (v.resetAt < now) buckets.delete(k);
  }
}
