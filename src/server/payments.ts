// Payment FX snapshot helper.
//
// Captures the exchange rate at the moment a Payment is created (and again
// when the Stripe webhook flips it to SUCCEEDED — the true "incasso"). The
// snapshot is frozen on the Payment row so fiscal reports remain stable
// across years even when ECB rates drift.
//
// Failure mode: when the FX provider is unreachable (`fx_unavailable`) we
// leave the snapshot null and log a warning. Payments MUST NOT be blocked by
// a missing FX rate — better to lose the snap than to lose the deposit.

import { db } from "@/lib/db";
import { getRate, convertCents } from "@/lib/fx";

export type PaymentFxSnapshot = {
  fxRateToBase: string | null;
  fxBaseCurrency: string | null;
  fxAmountBaseCents: number | null;
};

const NULL_SNAPSHOT: PaymentFxSnapshot = {
  fxRateToBase: null,
  fxBaseCurrency: null,
  fxAmountBaseCents: null,
};

export async function enrichPaymentWithFx(input: {
  venueId: string;
  amountCents: number;
  currency: string;
}): Promise<PaymentFxSnapshot> {
  try {
    const venue = await db.venue.findUnique({
      where: { id: input.venueId },
      select: { org: { select: { baseCurrency: true } } },
    });
    const baseCurrency = venue?.org?.baseCurrency ?? null;
    if (!baseCurrency) {
      // No org / no baseCurrency — can't snapshot, but don't break the payment.
      return NULL_SNAPSHOT;
    }

    const native = input.currency.toUpperCase();
    const base = baseCurrency.toUpperCase();

    if (native === base) {
      return {
        fxRateToBase: "1.000000",
        fxBaseCurrency: base,
        fxAmountBaseCents: input.amountCents,
      };
    }

    const rate = await getRate(native, base);
    const amountBase = await convertCents(input.amountCents, native, base);
    // Store with 6 decimals to match the Decimal(12,6) column.
    return {
      fxRateToBase: rate.toFixed(6),
      fxBaseCurrency: base,
      fxAmountBaseCents: amountBase,
    };
  } catch (err) {
    const code = err instanceof Error ? err.message : String(err);
    console.warn(
      `[payments:fx] snapshot skipped venue=${input.venueId} ${input.currency} ${input.amountCents}c: ${code}`,
    );
    return NULL_SNAPSHOT;
  }
}

/**
 * Recompute the FX snapshot at the moment a Payment is confirmed (Stripe
 * webhook → SUCCEEDED). This is the true "incasso" timestamp for fiscal
 * purposes. The Stripe Checkout PENDING row was created moments-to-days
 * earlier; if the ECB daily rate has rolled over between create and capture,
 * we want the rate that was effective on capture day.
 *
 * No-op if a snapshot already exists with the current day's rate, or if FX
 * is unavailable (we keep whatever was set at create time).
 */
export async function refreshPaymentFxOnCapture(
  stripePaymentId: string,
): Promise<void> {
  const rows = await db.payment.findMany({
    where: { stripePaymentId },
    select: {
      id: true,
      venueId: true,
      amountCents: true,
      currency: true,
    },
  });
  for (const row of rows) {
    const snap = await enrichPaymentWithFx(row);
    if (snap.fxRateToBase === null) continue;
    await db.payment
      .update({
        where: { id: row.id },
        data: {
          fxRateToBase: snap.fxRateToBase,
          fxBaseCurrency: snap.fxBaseCurrency,
          fxAmountBaseCents: snap.fxAmountBaseCents,
        },
      })
      .catch((err) => {
        console.warn(
          `[payments:fx] capture-time refresh failed payment=${row.id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      });
  }
}
