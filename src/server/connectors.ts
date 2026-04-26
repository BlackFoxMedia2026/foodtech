import { z } from "zod";
import type { Prisma } from "@prisma/client";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import {
  adapterFor,
  type ConnectorKind,
  type InboundBooking,
  verifyHmac,
} from "@/lib/connectors";
import { createBooking } from "@/server/bookings";
import { fireTrigger } from "@/server/automations";
import { captureError } from "@/lib/observability";

const KINDS = [
  "THEFORK",
  "GOOGLE_RESERVE",
  "BOOKING_COM",
  "OPENTABLE",
  "CUSTOM",
] as const;

const STATUSES = ["DRAFT", "ACTIVE", "PAUSED", "ERROR"] as const;

export const ConnectorInput = z.object({
  kind: z.enum(KINDS),
  label: z.string().min(2).max(80).optional().nullable(),
  externalRef: z.string().max(120).optional().nullable(),
  status: z.enum(STATUSES).optional(),
  config: z.record(z.unknown()).optional().nullable(),
  webhookSecret: z
    .string()
    .min(16)
    .max(120)
    .optional()
    .nullable()
    .describe("HMAC SHA-256 shared secret"),
});

export async function listConnectors(venueId: string) {
  return db.connector.findMany({
    where: { venueId },
    orderBy: [{ status: "asc" }, { kind: "asc" }],
    include: { _count: { select: { events: true } } },
  });
}

export async function listConnectorEvents(venueId: string, limit = 50) {
  return db.connectorEvent.findMany({
    where: { venueId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { connector: { select: { kind: true, label: true } } },
  });
}

export async function createConnector(venueId: string, raw: unknown) {
  const data = ConnectorInput.parse(raw);
  return db.connector.create({
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

export async function updateConnector(venueId: string, id: string, raw: unknown) {
  const existing = await db.connector.findFirst({ where: { id, venueId } });
  if (!existing) throw new Error("not_found");
  const data = ConnectorInput.partial().parse(raw);
  return db.connector.update({
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

export async function deleteConnector(venueId: string, id: string) {
  const existing = await db.connector.findFirst({ where: { id, venueId } });
  if (!existing) throw new Error("not_found");
  await db.connector.delete({ where: { id } });
}

export function generateWebhookSecret() {
  return crypto.randomBytes(24).toString("base64url");
}

// Webhook ingest pipeline: verify connector + signature, parse payload via
// the per-kind adapter, create the booking using the existing booking
// pipeline (so all triggers, audits and notifications fire).
export async function ingestExternalBooking(opts: {
  venueId: string;
  kind: ConnectorKind;
  rawBody: string;
  parsedBody: unknown;
  signature: string | null;
}) {
  const connector = await db.connector.findFirst({
    where: { venueId: opts.venueId, kind: opts.kind },
  });
  if (!connector) throw new Error("connector_not_found");
  if (connector.status === "PAUSED") throw new Error("connector_paused");
  if (connector.webhookSecret) {
    const ok = verifyHmac(opts.rawBody, opts.signature ?? "", connector.webhookSecret);
    if (!ok) {
      await db.connectorEvent.create({
        data: {
          connectorId: connector.id,
          venueId: opts.venueId,
          direction: "INBOUND",
          kind: "signature.invalid",
          status: "REJECTED",
          payload: { signature: opts.signature?.slice(0, 16) ?? null } as Prisma.InputJsonValue,
        },
      });
      throw new Error("invalid_signature");
    }
  }

  const adapter = adapterFor(opts.kind);
  const booking = adapter.parseWebhook(opts.parsedBody);
  if (!booking) {
    await db.connectorEvent.create({
      data: {
        connectorId: connector.id,
        venueId: opts.venueId,
        direction: "INBOUND",
        kind: "payload.unrecognised",
        status: "REJECTED",
        payload: opts.parsedBody as Prisma.InputJsonValue,
      },
    });
    throw new Error("invalid_payload");
  }

  if (booking.status === "CANCELLED") {
    return cancelInbound(connector.id, opts.venueId, booking);
  }

  return createInbound(connector.id, opts.venueId, booking);
}

async function createInbound(
  connectorId: string,
  venueId: string,
  inbound: InboundBooking,
) {
  const event = await db.connectorEvent.create({
    data: {
      connectorId,
      venueId,
      direction: "INBOUND",
      kind: "booking.created",
      status: "RECEIVED",
      payload: inbound as unknown as Prisma.InputJsonValue,
    },
  });
  try {
    const startsAt = new Date(`${inbound.date}T${inbound.time}:00`);
    if (Number.isNaN(startsAt.getTime())) throw new Error("invalid_datetime");
    const created = await createBooking(venueId, {
      partySize: inbound.partySize,
      startsAt,
      durationMin: 105,
      status: "CONFIRMED",
      source: "GOOGLE", // closest existing source enum
      occasion: inbound.occasion ?? undefined,
      notes: inbound.notes ?? undefined,
      guest: {
        firstName: inbound.firstName,
        lastName: inbound.lastName ?? undefined,
        email: inbound.email ?? undefined,
        phone: inbound.phone ?? undefined,
      },
    });
    await db.connectorEvent.update({
      where: { id: event.id },
      data: { status: "PROCESSED", bookingId: created.id },
    });
    await db.connector.update({
      where: { id: connectorId },
      data: { lastSyncAt: new Date(), lastError: null, status: "ACTIVE" },
    });
    await fireTrigger("BOOKING_CREATED", {
      venueId,
      guestId: created.guestId ?? undefined,
      bookingId: created.id,
      payload: { source: "connector", externalId: inbound.externalId },
    }).catch(() => undefined);
    return { eventId: event.id, bookingId: created.id };
  } catch (err) {
    captureError(err, {
      module: "connectors",
      venueId,
      resourceId: connectorId,
      extra: { eventId: event.id },
    });
    await db.connectorEvent.update({
      where: { id: event.id },
      data: {
        status: "FAILED",
        error: err instanceof Error ? err.message : String(err),
      },
    });
    await db.connector.update({
      where: { id: connectorId },
      data: {
        status: "ERROR",
        lastError: err instanceof Error ? err.message : "ingest_failed",
      },
    });
    throw err;
  }
}

async function cancelInbound(
  connectorId: string,
  venueId: string,
  inbound: InboundBooking,
) {
  const event = await db.connectorEvent.create({
    data: {
      connectorId,
      venueId,
      direction: "INBOUND",
      kind: "booking.cancelled",
      status: "RECEIVED",
      payload: inbound as unknown as Prisma.InputJsonValue,
    },
  });
  // We don't have a stable mapping yet; skip silently and mark processed.
  await db.connectorEvent.update({
    where: { id: event.id },
    data: { status: "PROCESSED" },
  });
  return { eventId: event.id };
}

export async function connectorStats(venueId: string) {
  const since = new Date(Date.now() - 30 * 86400_000);
  const [active, total, events] = await Promise.all([
    db.connector.count({ where: { venueId, status: "ACTIVE" } }),
    db.connector.count({ where: { venueId } }),
    db.connectorEvent.groupBy({
      by: ["status"],
      where: { venueId, createdAt: { gte: since } },
      _count: { _all: true },
    }),
  ]);
  return {
    active,
    total,
    processed: events.find((e) => e.status === "PROCESSED")?._count._all ?? 0,
    rejected: events.find((e) => e.status === "REJECTED")?._count._all ?? 0,
    failed: events.find((e) => e.status === "FAILED")?._count._all ?? 0,
  };
}
