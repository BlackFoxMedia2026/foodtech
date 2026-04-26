import { z } from "zod";
import { db } from "@/lib/db";

// Simple loyalty: 1 point per €1 spent (configurable in code), tracked via
// LoyaltyTransaction rows so we keep an audit trail. Guest.loyaltyPoints is
// the running balance (denormalized for cheap reads on the guest profile).

export const POINTS_PER_EURO = 1;
export const MIN_REDEMPTION = 100;

export const AdjustInput = z.object({
  guestId: z.string(),
  delta: z.coerce.number().int(),
  reason: z.string().min(2).max(200),
  bookingId: z.string().optional().nullable(),
  orderId: z.string().optional().nullable(),
});

type Kind = "EARNED" | "REDEEMED" | "ADJUSTED" | "EXPIRED";

export async function recordTransaction(opts: {
  guestId: string;
  venueId: string;
  delta: number;
  kind: Kind;
  reason?: string | null;
  bookingId?: string | null;
  orderId?: string | null;
  createdBy?: string | null;
}) {
  if (opts.delta === 0) return null;
  // Atomic: log + bump balance in a transaction so the running total stays
  // consistent under parallel automation runs.
  return db.$transaction(async (tx) => {
    const txn = await tx.loyaltyTransaction.create({
      data: {
        guestId: opts.guestId,
        venueId: opts.venueId,
        kind: opts.kind,
        points: opts.delta,
        reason: opts.reason ?? null,
        bookingId: opts.bookingId ?? null,
        orderId: opts.orderId ?? null,
        createdBy: opts.createdBy ?? null,
      },
    });
    await tx.guest.update({
      where: { id: opts.guestId },
      data: { loyaltyPoints: { increment: opts.delta } },
    });
    return txn;
  });
}

// Auto-earn from an order total. Called from updateOrderStatus when an order
// transitions to COMPLETED. Idempotent on the orderId so re-firing the
// trigger doesn't double-credit the guest.
export async function awardOrderPoints(opts: {
  venueId: string;
  guestId: string;
  orderId: string;
  totalCents: number;
}) {
  const existing = await db.loyaltyTransaction.findFirst({
    where: { guestId: opts.guestId, orderId: opts.orderId, kind: "EARNED" },
    select: { id: true },
  });
  if (existing) return null;
  const earned = Math.floor((opts.totalCents / 100) * POINTS_PER_EURO);
  if (earned <= 0) return null;
  return recordTransaction({
    venueId: opts.venueId,
    guestId: opts.guestId,
    orderId: opts.orderId,
    delta: earned,
    kind: "EARNED",
    reason: `Ordine #${opts.orderId.slice(-6)}`,
  });
}

export async function awardBookingPoints(opts: {
  venueId: string;
  guestId: string;
  bookingId: string;
  partySize: number;
}) {
  const existing = await db.loyaltyTransaction.findFirst({
    where: { guestId: opts.guestId, bookingId: opts.bookingId, kind: "EARNED" },
    select: { id: true },
  });
  if (existing) return null;
  // Without a real check, fall back to 5 points per cover.
  const earned = opts.partySize * 5;
  return recordTransaction({
    venueId: opts.venueId,
    guestId: opts.guestId,
    bookingId: opts.bookingId,
    delta: earned,
    kind: "EARNED",
    reason: `Visita confermata · ${opts.partySize} pax`,
  });
}

export async function adjustPoints(
  venueId: string,
  raw: unknown,
  createdBy: string | null,
) {
  const data = AdjustInput.parse(raw);
  const guest = await db.guest.findFirst({
    where: { id: data.guestId, venueId },
    select: { id: true, loyaltyPoints: true },
  });
  if (!guest) throw new Error("not_found");
  const willBe = guest.loyaltyPoints + data.delta;
  if (willBe < 0) throw new Error("negative_balance");
  return recordTransaction({
    venueId,
    guestId: guest.id,
    delta: data.delta,
    kind: data.delta > 0 ? "ADJUSTED" : "REDEEMED",
    reason: data.reason,
    bookingId: data.bookingId ?? null,
    orderId: data.orderId ?? null,
    createdBy,
  });
}

export async function loyaltyHistory(guestId: string, limit = 20) {
  return db.loyaltyTransaction.findMany({
    where: { guestId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function loyaltyLeaderboard(venueId: string, limit = 10) {
  return db.guest.findMany({
    where: { venueId, loyaltyPoints: { gt: 0 } },
    orderBy: [{ loyaltyPoints: "desc" }, { totalVisits: "desc" }],
    take: limit,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      loyaltyTier: true,
      loyaltyPoints: true,
      totalVisits: true,
    },
  });
}
