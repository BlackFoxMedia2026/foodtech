import Stripe from "stripe";

let _client: Stripe | null = null;

export function isStripeEnabled() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function stripe() {
  if (_client) return _client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  _client = new Stripe(key, { apiVersion: "2025-02-24.acacia" });
  return _client;
}

export type DepositPlan = {
  required: boolean;
  amountCents: number;
  perPersonCents: number;
  threshold: number;
  reason?: "below_threshold" | "stripe_off";
};

export function planDeposit(opts: {
  partySize: number;
  threshold: number;
  perPersonCents: number;
}): DepositPlan {
  if (!isStripeEnabled()) {
    return {
      required: false,
      amountCents: 0,
      perPersonCents: opts.perPersonCents,
      threshold: opts.threshold,
      reason: "stripe_off",
    };
  }
  if (opts.partySize < opts.threshold) {
    return {
      required: false,
      amountCents: 0,
      perPersonCents: opts.perPersonCents,
      threshold: opts.threshold,
      reason: "below_threshold",
    };
  }
  return {
    required: true,
    amountCents: opts.partySize * opts.perPersonCents,
    perPersonCents: opts.perPersonCents,
    threshold: opts.threshold,
  };
}
