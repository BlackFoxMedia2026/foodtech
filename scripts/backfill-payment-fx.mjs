#!/usr/bin/env node
// Backfill fxRateToBase/fxBaseCurrency/fxAmountBaseCents on historical
// Payment rows that predate the snapshot column.
//
// Strategy:
//   1. Load Org → baseCurrency map (cached) so we know the target.
//   2. For each Payment with fxRateToBase=null:
//      a. Skip if same-currency (rate=1 trivially).
//      b. Skip if older than 5 years (ECB/Frankfurter has stricter limits).
//      c. Fetch historical rate via `https://api.frankfurter.app/{date}`.
//      d. Write snapshot back.
//   3. Rate limit: 1 req/sec to be polite to the free public endpoint.
//
// Usage:
//   node scripts/backfill-payment-fx.mjs
//   DRY_RUN=1 node scripts/backfill-payment-fx.mjs
//
// Safe to re-run: only touches rows where fxRateToBase IS NULL.

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const DRY_RUN = process.env.DRY_RUN === "1";
const MAX_AGE_MS = 5 * 365 * 24 * 60 * 60 * 1000;
const RATE_LIMIT_MS = 1000;

function ymd(d) {
  // Frankfurter expects YYYY-MM-DD; use UTC to be deterministic.
  return d.toISOString().slice(0, 10);
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Per-(from,to,date) memoization — multiple payments same day, same pair,
// hit Frankfurter only once.
const rateCache = new Map();

async function fetchHistoricalRate(date, from, to) {
  const key = `${date}|${from}|${to}`;
  if (rateCache.has(key)) return rateCache.get(key);

  const url = `https://api.frankfurter.app/${date}?from=${from}&to=${to}`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`frankfurter_http_${res.status}`);
  const body = await res.json();
  const rate = body?.rates?.[to];
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
    throw new Error("frankfurter_bad_payload");
  }
  rateCache.set(key, rate);
  await sleep(RATE_LIMIT_MS);
  return rate;
}

async function main() {
  const now = Date.now();

  // Pull all payments missing the snap, with their org baseCurrency in one go.
  const rows = await db.payment.findMany({
    where: { fxRateToBase: null },
    select: {
      id: true,
      amountCents: true,
      currency: true,
      createdAt: true,
      venue: {
        select: {
          orgId: true,
          org: { select: { baseCurrency: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`[backfill] ${rows.length} payments to consider (DRY_RUN=${DRY_RUN})`);

  let done = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    const base = row.venue?.org?.baseCurrency ?? null;
    if (!base) {
      skipped++;
      continue;
    }
    const native = (row.currency ?? "EUR").toUpperCase();
    const target = base.toUpperCase();

    // Same-currency: trivial snap.
    if (native === target) {
      if (!DRY_RUN) {
        await db.payment.update({
          where: { id: row.id },
          data: {
            fxRateToBase: "1.000000",
            fxBaseCurrency: target,
            fxAmountBaseCents: row.amountCents,
          },
        });
      }
      done++;
      continue;
    }

    if (now - row.createdAt.getTime() > MAX_AGE_MS) {
      console.warn(`[backfill] skip ${row.id}: older than 5y`);
      skipped++;
      continue;
    }

    const date = ymd(row.createdAt);
    try {
      const rate = await fetchHistoricalRate(date, native, target);
      const amountBase = Math.round(row.amountCents * rate);
      if (!DRY_RUN) {
        await db.payment.update({
          where: { id: row.id },
          data: {
            fxRateToBase: rate.toFixed(6),
            fxBaseCurrency: target,
            fxAmountBaseCents: amountBase,
          },
        });
      }
      done++;
      if (done % 25 === 0) {
        console.log(`[backfill] progress ${done}/${rows.length}`);
      }
    } catch (err) {
      failed++;
      console.warn(
        `[backfill] fail ${row.id} (${native}->${target} @ ${date}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  console.log(
    `[backfill] done=${done} skipped=${skipped} failed=${failed} total=${rows.length}`,
  );
  await db.$disconnect();
}

main().catch(async (err) => {
  console.error("[backfill] fatal", err);
  await db.$disconnect();
  process.exit(1);
});
