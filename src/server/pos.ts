import { z } from "zod";
import type { Prisma } from "@prisma/client";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import {
  type InboundSale,
  type POSKind,
  posAdapterFor,
  verifyPosHmac,
} from "@/lib/pos";
import { awardOrderPoints } from "@/server/loyalty";
import { captureError } from "@/lib/observability";

const KINDS = ["SQUARE", "LIGHTSPEED", "SUMUP", "IZETTLE", "TOAST", "CUSTOM"] as const;
const STATUSES = ["DRAFT", "ACTIVE", "PAUSED", "ERROR"] as const;

export const POSConnectorInput = z.object({
  kind: z.enum(KINDS),
  label: z.string().min(2).max(80).optional().nullable(),
  externalRef: z.string().max(120).optional().nullable(),
  status: z.enum(STATUSES).optional(),
  config: z.record(z.unknown()).optional().nullable(),
  webhookSecret: z.string().min(16).max(120).optional().nullable(),
});

export async function listPOSConnectors(venueId: string) {
  return db.pOSConnector.findMany({
    where: { venueId },
    orderBy: [{ status: "asc" }, { kind: "asc" }],
    include: { _count: { select: { events: true } } },
  });
}

export async function listPOSEvents(venueId: string, limit = 30) {
  return db.pOSEvent.findMany({
    where: { venueId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { connector: { select: { kind: true, label: true } } },
  });
}

export async function createPOSConnector(venueId: string, raw: unknown) {
  const data = POSConnectorInput.parse(raw);
  return db.pOSConnector.create({
    data: {
      venueId,
      kind: data.kind,
      label: data.label ?? null,
      externalRef: data.externalRef ?? null,
      status: data.status ?? "DRAFT",
      config: (data.config ?? undefined) as Prisma.InputJsonValue | undefined,
      webhookSecret: data.webhookSecret ?? null,
    },
  });
}

export async function updatePOSConnector(
  venueId: string,
  id: string,
  raw: unknown,
) {
  const existing = await db.pOSConnector.findFirst({ where: { id, venueId } });
  if (!existing) throw new Error("not_found");
  const data = POSConnectorInput.partial().parse(raw);
  return db.pOSConnector.update({
    where: { id },
    data: {
      kind: data.kind ?? undefined,
      label: data.label === undefined ? undefined : data.label ?? null,
      externalRef:
        data.externalRef === undefined ? undefined : data.externalRef ?? null,
      status: data.status ?? undefined,
      config:
        data.config === undefined
          ? undefined
          : ((data.config ?? undefined) as Prisma.InputJsonValue | undefined),
      webhookSecret:
        data.webhookSecret === undefined
          ? undefined
          : data.webhookSecret ?? null,
    },
  });
}

export async function deletePOSConnector(venueId: string, id: string) {
  const existing = await db.pOSConnector.findFirst({ where: { id, venueId } });
  if (!existing) throw new Error("not_found");
  await db.pOSConnector.delete({ where: { id } });
}

export function generatePOSWebhookSecret() {
  return crypto.randomBytes(24).toString("base64url");
}

export async function ingestInboundSale(opts: {
  venueId: string;
  kind: POSKind;
  rawBody: string;
  parsedBody: unknown;
  signature: string | null;
}) {
  const connector = await db.pOSConnector.findFirst({
    where: { venueId: opts.venueId, kind: opts.kind },
  });
  if (!connector) throw new Error("connector_not_found");
  if (connector.status === "PAUSED") throw new Error("connector_paused");
  if (connector.webhookSecret) {
    const ok = verifyPosHmac(
      opts.rawBody,
      opts.signature ?? "",
      connector.webhookSecret,
    );
    if (!ok) {
      await db.pOSEvent.create({
        data: {
          posConnectorId: connector.id,
          venueId: opts.venueId,
          action: "signature.invalid",
          status: "REJECTED",
          payload: { signature: opts.signature?.slice(0, 16) ?? null } as Prisma.InputJsonValue,
        },
      });
      throw new Error("invalid_signature");
    }
  }
  const adapter = posAdapterFor(opts.kind);
  const sale = adapter.parseWebhook(opts.parsedBody);
  if (!sale) {
    await db.pOSEvent.create({
      data: {
        posConnectorId: connector.id,
        venueId: opts.venueId,
        action: "payload.unrecognised",
        status: "REJECTED",
        payload: opts.parsedBody as Prisma.InputJsonValue,
      },
    });
    throw new Error("invalid_payload");
  }
  return persistSale(connector.id, opts.venueId, sale);
}

async function persistSale(
  connectorId: string,
  venueId: string,
  sale: InboundSale,
) {
  const event = await db.pOSEvent.create({
    data: {
      posConnectorId: connectorId,
      venueId,
      externalRef: sale.externalRef,
      action: sale.action ?? "sale.created",
      amountCents: sale.totalCents,
      currency: sale.currency,
      payload: sale as unknown as Prisma.InputJsonValue,
      status: "RECEIVED",
    },
  });
  try {
    let bookingId: string | null = null;
    let guestId: string | null = null;
    if (sale.bookingReference) {
      const booking = await db.booking.findUnique({
        where: { reference: sale.bookingReference },
        select: { id: true, venueId: true, guestId: true },
      });
      if (booking && booking.venueId === venueId) {
        bookingId = booking.id;
        guestId = booking.guestId;
      }
    }
    const order = await db.order.create({
      data: {
        venueId,
        guestId,
        kind: "TAKEAWAY",
        status: sale.action === "sale.refunded" ? "CANCELLED" : "COMPLETED",
        paymentStatus: sale.action === "sale.refunded" ? "REFUNDED" : "SUCCEEDED",
        customerName: sale.customerName ?? "POS sale",
        phone: sale.phone ?? "",
        email: sale.email ?? null,
        scheduledAt: sale.occurredAt ?? new Date(),
        totalCents: sale.totalCents,
        currency: sale.currency,
        completedAt: sale.action === "sale.refunded" ? null : new Date(),
        cancelledAt: sale.action === "sale.refunded" ? new Date() : null,
        notes: bookingId ? `Vendita POS · prenotazione ${sale.bookingReference}` : "Vendita POS",
        items: sale.items?.length
          ? {
              create: sale.items.map((it) => ({
                name: it.name,
                priceCents: it.priceCents,
                quantity: it.quantity,
              })),
            }
          : undefined,
      },
    });
    if (guestId && sale.action !== "sale.refunded") {
      await awardOrderPoints({
        venueId,
        guestId,
        orderId: order.id,
        totalCents: sale.totalCents,
      }).catch(() => undefined);
    }
    await db.pOSEvent.update({
      where: { id: event.id },
      data: { status: "PROCESSED", orderId: order.id },
    });
    await db.pOSConnector.update({
      where: { id: connectorId },
      data: { lastSyncAt: new Date(), lastError: null, status: "ACTIVE" },
    });
    return { eventId: event.id, orderId: order.id };
  } catch (err) {
    captureError(err, {
      module: "pos",
      venueId,
      resourceId: connectorId,
      extra: { eventId: event.id },
    });
    await db.pOSEvent.update({
      where: { id: event.id },
      data: {
        status: "FAILED",
        error: err instanceof Error ? err.message : String(err),
      },
    });
    await db.pOSConnector.update({
      where: { id: connectorId },
      data: {
        status: "ERROR",
        lastError: err instanceof Error ? err.message : "ingest_failed",
      },
    });
    throw err;
  }
}

export async function posStats(venueId: string) {
  const since = new Date(Date.now() - 30 * 86400_000);
  const [active, total, processed, failed, sales] = await Promise.all([
    db.pOSConnector.count({ where: { venueId, status: "ACTIVE" } }),
    db.pOSConnector.count({ where: { venueId } }),
    db.pOSEvent.count({
      where: { venueId, status: "PROCESSED", createdAt: { gte: since } },
    }),
    db.pOSEvent.count({
      where: {
        venueId,
        status: { in: ["FAILED", "REJECTED"] },
        createdAt: { gte: since },
      },
    }),
    db.pOSEvent.aggregate({
      where: {
        venueId,
        status: "PROCESSED",
        createdAt: { gte: since },
        action: "sale.created",
      },
      _sum: { amountCents: true },
    }),
  ]);
  return {
    activeCount: active,
    totalCount: total,
    processed30d: processed,
    failed30d: failed,
    revenue30dCents: sales._sum.amountCents ?? 0,
  };
}
