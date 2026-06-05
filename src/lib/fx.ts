// FX provider adapter (Frankfurter, ECB-based, no API key).
//
// We expose two primitives:
//   - getRate(from, to)        → numeric rate (e.g. 1 GBP → 1.17 EUR)
//   - convertCents(amount, …)  → integer cents in target currency
//
// Cache policy: rates are stored in `ExchangeRate` rows. A fresh fetch is
// triggered when no row younger than today 00:00 exists for the pair. If the
// provider is unreachable we fall back to the most recent rate of any age
// and emit a warning — better stale than nothing for portfolio reporting.
//
// Coherent with email/messaging/voice adapter pattern: no env keys required,
// the network call is best-effort and degrades gracefully so build/test
// environments without internet keep working.

import { db } from "./db";

const FRANKFURTER_URL = "https://api.frankfurter.app/latest";

// Acceptable ISO 4217 alphabetic codes — guard against typos in callers.
const CURRENCY_RE = /^[A-Z]{3}$/;

function normalize(code: string): string {
  return code.trim().toUpperCase();
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Returns the exchange rate `from → to`. If the codes are identical, returns
 * 1 immediately. Reads-through to Frankfurter when no fresh rate is cached.
 * Throws `fx_unavailable` when both the network call and the cache miss.
 */
export async function getRate(from: string, to: string): Promise<number> {
  const f = normalize(from);
  const t = normalize(to);
  if (!CURRENCY_RE.test(f) || !CURRENCY_RE.test(t)) {
    throw new Error("fx_invalid_currency");
  }
  if (f === t) return 1;

  // 1. Fresh cache hit (rate fetched today)
  const fresh = await db.exchangeRate.findFirst({
    where: { from: f, to: t, fetchedAt: { gte: startOfToday() } },
    orderBy: { fetchedAt: "desc" },
  });
  if (fresh) return Number(fresh.rate);

  // 2. Try to fetch from Frankfurter
  try {
    const url = `${FRANKFURTER_URL}?from=${encodeURIComponent(f)}&to=${encodeURIComponent(t)}`;
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      // Frankfurter is fast; avoid hanging an API request.
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`frankfurter_http_${res.status}`);
    const body = (await res.json()) as { rates?: Record<string, number> };
    const rate = body?.rates?.[t];
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
      throw new Error("frankfurter_bad_payload");
    }
    // Persist and return. We tolerate write conflicts on the unique
    // (from,to,fetchedAt) index — same-millisecond duplicate is harmless.
    await db.exchangeRate
      .create({
        data: { from: f, to: t, rate: rate.toString() },
      })
      .catch(() => undefined);
    return rate;
  } catch (e) {
    // 3. Stale fallback — any previous rate beats throwing.
    const stale = await db.exchangeRate.findFirst({
      where: { from: f, to: t },
      orderBy: { fetchedAt: "desc" },
    });
    if (stale) {
      console.warn(
        `[fx] using stale rate ${f}->${t}=${stale.rate} (fetched ${stale.fetchedAt.toISOString()}): ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
      return Number(stale.rate);
    }
    throw new Error("fx_unavailable");
  }
}

/**
 * Convert an amount expressed in integer cents from `from` to `to`. Internal
 * math uses floating point but the result is rounded back to an integer cent
 * value, which is the storage convention everywhere in the schema.
 */
export async function convertCents(
  amountCents: number,
  from: string,
  to: string,
): Promise<number> {
  if (!Number.isFinite(amountCents)) return 0;
  if (amountCents === 0) return 0;
  const rate = await getRate(from, to);
  return Math.round(amountCents * rate);
}

/**
 * Batched variant for portfolio aggregations: resolves rates once per source
 * currency and reuses them for every amount. Returns a `Map<from,rate>` so
 * callers can convert many amounts without re-querying the cache.
 */
export async function getRatesTo(
  froms: string[],
  to: string,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const unique = Array.from(new Set(froms.map(normalize)));
  for (const f of unique) {
    try {
      out.set(f, await getRate(f, to));
    } catch {
      // Skip unresolvable pairs; caller decides whether to drop or surface.
    }
  }
  return out;
}
