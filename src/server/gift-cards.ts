import { z } from "zod";
import crypto from "node:crypto";
import { db } from "@/lib/db";

export const GiftCardInput = z.object({
  amount: z.coerce.number().min(5).max(10_000), // EUR (display); we convert to cents internally
  currency: z.string().length(3).optional(),
  recipientName: z.string().max(80).optional().nullable(),
  recipientEmail: z.string().email().optional().nullable().or(z.literal("")),
  senderName: z.string().max(80).optional().nullable(),
  message: z.string().max(500).optional().nullable(),
  expiresInDays: z.coerce.number().int().min(1).max(3650).optional(),
  status: z.enum(["ACTIVE", "PENDING_PAYMENT"]).optional(),
});

export const RedeemInput = z.object({
  code: z.string().min(4).max(40),
  amount: z.coerce.number().min(0.01),
  reason: z.string().max(200).optional().nullable(),
  bookingId: z.string().optional().nullable(),
  orderId: z.string().optional().nullable(),
});

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // unambiguous

function genCode() {
  // GIFT-XXXX-XXXX
  const seg = (n: number) =>
    Array.from({ length: n }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");
  return `GIFT-${seg(4)}-${seg(4)}`;
}

export async function listGiftCards(venueId: string) {
  return db.giftCard.findMany({
    where: { venueId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
    include: { _count: { select: { redemptions: true } } },
  });
}

export async function createGiftCard(
  venueId: string,
  raw: unknown,
  createdBy: string | null,
) {
  const data = GiftCardInput.parse(raw);
  const cents = Math.round(data.amount * 100);
  const expiresAt = data.expiresInDays
    ? new Date(Date.now() + data.expiresInDays * 86400_000)
    : null;
  return db.giftCard.create({
    data: {
      venueId,
      code: genCode(),
      initialCents: cents,
      balanceCents: cents,
      currency: data.currency ?? "EUR",
      recipientName: data.recipientName ?? null,
      recipientEmail: data.recipientEmail || null,
      senderName: data.senderName ?? null,
      message: data.message ?? null,
      expiresAt,
      status: data.status ?? "ACTIVE",
      createdBy,
    },
  });
}

export async function deleteGiftCard(venueId: string, id: string) {
  const existing = await db.giftCard.findFirst({ where: { id, venueId } });
  if (!existing) throw new Error("not_found");
  if (existing.balanceCents !== existing.initialCents)
    throw new Error("partially_redeemed");
  await db.giftCard.delete({ where: { id } });
}

// Public lookup. We hash compare the venue slug separately at the route
// layer so the URL leaks nothing besides the code. Returns sanitized fields.
export async function lookupGiftCard(code: string) {
  const card = await db.giftCard.findUnique({
    where: { code: normaliseCode(code) },
    include: {
      venue: { select: { name: true, slug: true, city: true, currency: true } },
    },
  });
  if (!card) return null;
  return {
    code: card.code,
    status: card.status,
    initialCents: card.initialCents,
    balanceCents: card.balanceCents,
    currency: card.currency,
    expiresAt: card.expiresAt,
    senderName: card.senderName,
    recipientName: card.recipientName,
    message: card.message,
    venue: card.venue,
  };
}

export async function redeemGiftCard(
  venueId: string,
  raw: unknown,
  createdBy: string | null,
) {
  const data = RedeemInput.parse(raw);
  const code = normaliseCode(data.code);
  const cents = Math.round(data.amount * 100);
  if (cents <= 0) throw new Error("invalid_amount");

  return db.$transaction(async (tx) => {
    const card = await tx.giftCard.findUnique({ where: { code } });
    if (!card || card.venueId !== venueId) throw new Error("wrong_venue");
    if (card.status !== "ACTIVE") throw new Error("not_active");
    if (card.expiresAt && card.expiresAt < new Date()) {
      await tx.giftCard.update({ where: { id: card.id }, data: { status: "EXPIRED" } });
      throw new Error("expired");
    }
    if (card.balanceCents < cents) throw new Error("insufficient_balance");
    const newBalance = card.balanceCents - cents;
    const updated = await tx.giftCard.update({
      where: { id: card.id },
      data: {
        balanceCents: newBalance,
        status: newBalance === 0 ? "EXHAUSTED" : "ACTIVE",
      },
    });
    const redemption = await tx.giftCardRedemption.create({
      data: {
        giftCardId: card.id,
        amountCents: cents,
        bookingId: data.bookingId ?? null,
        orderId: data.orderId ?? null,
        reason: data.reason ?? null,
        createdBy,
      },
    });
    return { card: updated, redemption };
  });
}

export async function giftCardStats(venueId: string) {
  const since = new Date(Date.now() - 30 * 86400_000);
  const [active, exhausted, soldThisMonth, redeemedThisMonth] = await Promise.all([
    db.giftCard.aggregate({
      where: { venueId, status: "ACTIVE" },
      _count: { _all: true },
      _sum: { balanceCents: true },
    }),
    db.giftCard.count({ where: { venueId, status: "EXHAUSTED" } }),
    db.giftCard.aggregate({
      where: { venueId, createdAt: { gte: since } },
      _count: { _all: true },
      _sum: { initialCents: true },
    }),
    db.giftCardRedemption.aggregate({
      where: { giftCard: { venueId }, createdAt: { gte: since } },
      _count: { _all: true },
      _sum: { amountCents: true },
    }),
  ]);
  return {
    activeCount: active._count._all,
    activeFloatCents: active._sum.balanceCents ?? 0,
    exhaustedCount: exhausted,
    soldCount30d: soldThisMonth._count._all,
    soldCents30d: soldThisMonth._sum.initialCents ?? 0,
    redemptionCount30d: redeemedThisMonth._count._all,
    redeemedCents30d: redeemedThisMonth._sum.amountCents ?? 0,
  };
}

export function normaliseCode(input: string) {
  return input.trim().toUpperCase();
}

// Cheap signed token used to "claim" the card via QR/email. Not strictly
// required for redemption (the operator types the code), but useful when
// you want to share a link that opens the public landing pre-filled.
export function signGiftCardCode(code: string) {
  const secret = process.env.NEXTAUTH_SECRET ?? "tavolo-gift";
  return crypto
    .createHmac("sha256", secret)
    .update(normaliseCode(code))
    .digest("hex")
    .slice(0, 16);
}
