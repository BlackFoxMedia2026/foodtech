import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

const KIND = z.enum(["PERCENT", "FIXED", "FREE_ITEM", "MENU_OFFER"]);
const CATEGORY = z.enum([
  "GENERIC",
  "BIRTHDAY",
  "WINBACK",
  "EVENT",
  "NEW_CUSTOMER",
  "WIFI",
  "REFERRAL",
  "STAFF",
]);
const STATUS = z.enum(["ACTIVE", "PAUSED", "EXPIRED", "ARCHIVED"]);

export const CouponInput = z.object({
  code: z
    .string()
    .min(3)
    .max(40)
    .regex(/^[A-Z0-9_-]+$/, "Solo lettere, numeri, _ e -, in maiuscolo")
    .optional(),
  name: z.string().min(2).max(80),
  description: z.string().max(500).optional().nullable(),
  kind: KIND.default("PERCENT"),
  value: z.coerce.number().int().min(0).max(100_000).default(0),
  freeItem: z.string().max(120).optional().nullable(),
  category: CATEGORY.default("GENERIC"),
  status: STATUS.optional(),
  validFrom: z.coerce.date().optional().nullable(),
  validUntil: z.coerce.date().optional().nullable(),
  maxRedemptions: z.coerce.number().int().min(1).optional().nullable(),
  maxPerGuest: z.coerce.number().int().min(1).max(100).default(1),
  guestId: z.string().optional().nullable(),
  segment: z.unknown().optional(),
});

export type CouponInputType = z.infer<typeof CouponInput>;

function autoCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export async function listCoupons(venueId: string) {
  return db.coupon.findMany({
    where: { venueId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
}

export async function getCouponByCode(code: string) {
  return db.coupon.findUnique({
    where: { code: code.toUpperCase() },
    include: {
      venue: { select: { id: true, name: true, slug: true, currency: true } },
      redemptions: {
        select: { guestId: true, redeemedAt: true },
      },
    },
  });
}

export async function createCoupon(venueId: string, raw: unknown) {
  const data = CouponInput.parse(raw);
  let code = (data.code ?? autoCode()).toUpperCase();
  // Avoid collisions
  for (let i = 0; i < 5; i++) {
    const existing = await db.coupon.findUnique({ where: { code } });
    if (!existing) break;
    code = autoCode();
  }
  if (data.kind === "PERCENT" && (data.value < 0 || data.value > 100)) {
    throw new Error("invalid_percent");
  }
  return db.coupon.create({
    data: {
      venueId,
      code,
      name: data.name,
      description: data.description ?? null,
      kind: data.kind,
      value: data.value,
      freeItem: data.freeItem ?? null,
      category: data.category,
      status: data.status ?? "ACTIVE",
      validFrom: data.validFrom ?? null,
      validUntil: data.validUntil ?? null,
      maxRedemptions: data.maxRedemptions ?? null,
      maxPerGuest: data.maxPerGuest,
      guestId: data.guestId ?? null,
      segment: (data.segment ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

export async function updateCoupon(venueId: string, id: string, raw: unknown) {
  const existing = await db.coupon.findFirst({ where: { id, venueId } });
  if (!existing) throw new Error("not_found");
  const data = CouponInput.partial().parse(raw);
  return db.coupon.update({
    where: { id },
    data: {
      name: data.name ?? undefined,
      description: data.description === undefined ? undefined : data.description ?? null,
      kind: data.kind ?? undefined,
      value: data.value ?? undefined,
      freeItem: data.freeItem === undefined ? undefined : data.freeItem ?? null,
      category: data.category ?? undefined,
      status: data.status ?? undefined,
      validFrom: data.validFrom === undefined ? undefined : data.validFrom ?? null,
      validUntil: data.validUntil === undefined ? undefined : data.validUntil ?? null,
      maxRedemptions:
        data.maxRedemptions === undefined ? undefined : data.maxRedemptions ?? null,
      maxPerGuest: data.maxPerGuest ?? undefined,
      guestId: data.guestId === undefined ? undefined : data.guestId ?? null,
      segment:
        data.segment === undefined
          ? undefined
          : ((data.segment ?? undefined) as Prisma.InputJsonValue | undefined),
    },
  });
}

export async function deleteCoupon(venueId: string, id: string) {
  const existing = await db.coupon.findFirst({ where: { id, venueId } });
  if (!existing) throw new Error("not_found");
  await db.coupon.delete({ where: { id } });
}

export type ValidationResult =
  | {
      ok: true;
      coupon: {
        id: string;
        code: string;
        name: string;
        description: string | null;
        kind: "PERCENT" | "FIXED" | "FREE_ITEM" | "MENU_OFFER";
        value: number;
        freeItem: string | null;
        validUntil: Date | null;
      };
      venue: { id: string; name: string; slug: string; currency: string };
    }
  | {
      ok: false;
      reason:
        | "not_found"
        | "expired"
        | "not_yet_valid"
        | "exhausted"
        | "guest_exhausted"
        | "wrong_guest"
        | "paused"
        | "archived";
    };

export async function validateCouponCode(code: string, opts: { guestId?: string } = {}): Promise<ValidationResult> {
  const c = await getCouponByCode(code);
  if (!c) return { ok: false, reason: "not_found" };
  const now = new Date();
  if (c.status === "ARCHIVED") return { ok: false, reason: "archived" };
  if (c.status === "PAUSED") return { ok: false, reason: "paused" };
  if (c.status === "EXPIRED") return { ok: false, reason: "expired" };
  if (c.validFrom && c.validFrom > now) return { ok: false, reason: "not_yet_valid" };
  if (c.validUntil && c.validUntil < now) return { ok: false, reason: "expired" };
  if (c.maxRedemptions != null && c.redemptionCount >= c.maxRedemptions) {
    return { ok: false, reason: "exhausted" };
  }
  if (c.guestId && opts.guestId && c.guestId !== opts.guestId) {
    return { ok: false, reason: "wrong_guest" };
  }
  if (opts.guestId) {
    const used = c.redemptions.filter((r) => r.guestId === opts.guestId).length;
    if (used >= c.maxPerGuest) return { ok: false, reason: "guest_exhausted" };
  }
  return {
    ok: true,
    coupon: {
      id: c.id,
      code: c.code,
      name: c.name,
      description: c.description,
      kind: c.kind,
      value: c.value,
      freeItem: c.freeItem,
      validUntil: c.validUntil,
    },
    venue: c.venue,
  };
}

export const RedeemInput = z.object({
  code: z.string(),
  guestId: z.string().optional().nullable(),
  bookingId: z.string().optional().nullable(),
  orderId: z.string().optional().nullable(),
  ticketId: z.string().optional().nullable(),
  amountCents: z.coerce.number().int().min(0).max(1_000_000).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export async function redeemCoupon(venueId: string, raw: unknown, redeemedBy?: string) {
  const data = RedeemInput.parse(raw);
  const validation = await validateCouponCode(data.code, { guestId: data.guestId ?? undefined });
  if (!validation.ok) throw new Error(validation.reason);
  if (validation.venue.id !== venueId) throw new Error("wrong_venue");

  const redemption = await db.couponRedemption.create({
    data: {
      couponId: validation.coupon.id,
      venueId,
      guestId: data.guestId ?? null,
      bookingId: data.bookingId ?? null,
      orderId: data.orderId ?? null,
      ticketId: data.ticketId ?? null,
      amountCents: data.amountCents ?? null,
      notes: data.notes ?? null,
      redeemedBy: redeemedBy ?? null,
    },
  });
  await db.coupon.update({
    where: { id: validation.coupon.id },
    data: { redemptionCount: { increment: 1 } },
  });
  return redemption;
}

export async function couponStats(venueId: string) {
  const [total, active, redeemed, recent] = await Promise.all([
    db.coupon.count({ where: { venueId } }),
    db.coupon.count({ where: { venueId, status: "ACTIVE" } }),
    db.couponRedemption.count({ where: { venueId } }),
    db.couponRedemption.aggregate({
      where: { venueId },
      _sum: { amountCents: true },
    }),
  ]);
  return {
    total,
    active,
    redeemed,
    valueCentsRedeemed: recent._sum.amountCents ?? 0,
  };
}
