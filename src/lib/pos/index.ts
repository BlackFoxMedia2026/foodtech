// POS integration adapter pattern. Mirrors lib/connectors but for sales:
// each provider (Square, Lightspeed, SumUp, iZettle, Toast, custom) implements
// a small interface that turns the inbound webhook payload into a canonical
// "Sale" object. The webhook ingest route then writes the Order via
// the existing pipeline so reports, loyalty and finance stay consistent.

import crypto from "node:crypto";

export type POSKind =
  | "SQUARE"
  | "LIGHTSPEED"
  | "SUMUP"
  | "IZETTLE"
  | "TOAST"
  | "CUSTOM";

export type InboundSale = {
  externalRef: string;
  totalCents: number;
  currency: string;
  customerName?: string | null;
  phone?: string | null;
  email?: string | null;
  items?: Array<{
    name: string;
    priceCents: number;
    quantity: number;
  }>;
  bookingReference?: string | null;
  occurredAt?: Date | null;
  action?: "sale.created" | "sale.refunded";
};

export interface POSAdapter {
  kind: POSKind;
  displayName: string;
  parseWebhook(body: unknown): InboundSale | null;
}

class GenericPOSAdapter implements POSAdapter {
  constructor(public kind: POSKind, public displayName: string) {}

  parseWebhook(body: unknown): InboundSale | null {
    if (typeof body !== "object" || !body) return null;
    const b = body as Record<string, unknown>;
    const totalCents = Number(b.totalCents ?? b.total_cents ?? b.amount ?? 0);
    if (!Number.isFinite(totalCents) || totalCents <= 0) return null;
    const externalRef =
      String(b.externalRef ?? b.external_ref ?? b.id ?? `ext-${Date.now()}`);
    return {
      externalRef,
      totalCents: Math.round(totalCents),
      currency: typeof b.currency === "string" ? b.currency : "EUR",
      customerName:
        typeof b.customerName === "string"
          ? b.customerName
          : typeof b.customer === "string"
            ? b.customer
            : null,
      phone: typeof b.phone === "string" ? b.phone : null,
      email: typeof b.email === "string" ? b.email : null,
      bookingReference:
        typeof b.bookingReference === "string"
          ? b.bookingReference
          : typeof b.booking_ref === "string"
            ? b.booking_ref
            : null,
      occurredAt: parseDate(b.occurredAt ?? b.occurred_at ?? b.timestamp),
      action: b.action === "sale.refunded" ? "sale.refunded" : "sale.created",
      items: Array.isArray(b.items)
        ? (b.items as unknown[])
            .map((it) => {
              if (typeof it !== "object" || !it) return null;
              const r = it as Record<string, unknown>;
              const price = Number(r.priceCents ?? r.price_cents ?? r.price ?? 0);
              const qty = Number(r.quantity ?? r.qty ?? 1);
              const name = typeof r.name === "string" ? r.name : "Articolo";
              if (!Number.isFinite(price) || !Number.isFinite(qty)) return null;
              return { name, priceCents: Math.round(price), quantity: Math.round(qty) };
            })
            .filter(
              (x): x is { name: string; priceCents: number; quantity: number } =>
                x !== null,
            )
        : undefined,
    };
  }
}

const ADAPTERS: Record<POSKind, POSAdapter> = {
  SQUARE: new GenericPOSAdapter("SQUARE", "Square"),
  LIGHTSPEED: new GenericPOSAdapter("LIGHTSPEED", "Lightspeed Restaurant"),
  SUMUP: new GenericPOSAdapter("SUMUP", "SumUp"),
  IZETTLE: new GenericPOSAdapter("IZETTLE", "iZettle / Zettle"),
  TOAST: new GenericPOSAdapter("TOAST", "Toast"),
  CUSTOM: new GenericPOSAdapter("CUSTOM", "Webhook personalizzato"),
};

export function posAdapterFor(kind: POSKind): POSAdapter {
  return ADAPTERS[kind] ?? ADAPTERS.CUSTOM;
}

export function verifyPosHmac(rawBody: string, signature: string, secret: string): boolean {
  if (!signature || !secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const provided = signature.replace(/^sha256=/, "").toLowerCase();
  if (provided.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  } catch {
    return false;
  }
}

function parseDate(raw: unknown): Date | null {
  if (!raw) return null;
  const d = new Date(raw as string | number);
  return Number.isNaN(d.getTime()) ? null : d;
}
