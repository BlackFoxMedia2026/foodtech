// Channel manager adapter pattern. Each external booking channel
// (TheFork, Google Reserve, Booking.com, OpenTable, custom) has its own
// adapter behind a common interface. Real provider SDKs are not pulled in:
// adapters are no-op stubs that mostly verify config and ingest payloads
// from a webhook. When the operator configures real credentials they swap
// the implementation by populating env / connector config.

import crypto from "node:crypto";

export type ConnectorKind =
  | "THEFORK"
  | "GOOGLE_RESERVE"
  | "BOOKING_COM"
  | "OPENTABLE"
  | "CUSTOM";

export type InboundBooking = {
  externalId: string;
  partySize: number;
  date: string;        // YYYY-MM-DD
  time: string;        // HH:MM
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  occasion?: string | null;
  status?: "CONFIRMED" | "CANCELLED" | "PENDING";
};

export type ConnectorConfig = {
  defaultDurationMin?: number;
  defaultPartySize?: number;
  externalCalendarId?: string;
  // Free-form per-adapter knobs go here.
  [key: string]: unknown;
};

export interface ConnectorAdapter {
  kind: ConnectorKind;
  displayName: string;
  // Validates the config + secret. Returns null on success or a string with
  // a human-readable hint on what's missing.
  verifyConfig(config: ConnectorConfig): string | null;
  // Best-effort signature check on inbound webhooks.
  verifySignature(req: Request, secret: string | null): boolean;
  // Translates the raw payload coming from the external service into our
  // canonical InboundBooking shape (or null when the payload is not a
  // booking event).
  parseWebhook(body: unknown): InboundBooking | null;
}

class GenericHmacAdapter implements ConnectorAdapter {
  constructor(public kind: ConnectorKind, public displayName: string) {}

  verifyConfig(_config: ConnectorConfig): string | null {
    return null;
  }

  verifySignature(req: Request, secret: string | null): boolean {
    if (!secret) return true; // no secret configured = accept (best-effort)
    const provided = req.headers.get("x-tavolo-signature") ?? "";
    if (!provided) return false;
    // We don't have the body cloned here; callers compute and pass the body
    // signature through `verifyHmac()` directly. This adapter's check is
    // limited to header presence; full HMAC compare lives in
    // verifyHmac(body, signature, secret).
    return provided.length >= 10;
  }

  parseWebhook(body: unknown): InboundBooking | null {
    if (typeof body !== "object" || !body) return null;
    const b = body as Record<string, unknown>;
    const partySize = Number(b.partySize ?? b.party_size ?? b.guests);
    const date = String(b.date ?? b.startDate ?? "");
    const time = String(b.time ?? b.startTime ?? "");
    const firstName = String(b.firstName ?? b.first_name ?? b.guestFirstName ?? "");
    if (!partySize || !date || !time || !firstName) return null;
    return {
      externalId: String(b.externalId ?? b.id ?? `ext-${Date.now()}`),
      partySize,
      date,
      time,
      firstName,
      lastName: typeof b.lastName === "string" ? b.lastName : null,
      email: typeof b.email === "string" ? b.email : null,
      phone: typeof b.phone === "string" ? b.phone : null,
      notes: typeof b.notes === "string" ? b.notes : null,
      occasion: typeof b.occasion === "string" ? b.occasion : null,
      status:
        b.status === "CANCELLED" || b.status === "PENDING" ? (b.status as never) : "CONFIRMED",
    };
  }
}

const ADAPTERS: Record<ConnectorKind, ConnectorAdapter> = {
  THEFORK: new GenericHmacAdapter("THEFORK", "TheFork"),
  GOOGLE_RESERVE: new GenericHmacAdapter("GOOGLE_RESERVE", "Google Reserve"),
  BOOKING_COM: new GenericHmacAdapter("BOOKING_COM", "Booking.com"),
  OPENTABLE: new GenericHmacAdapter("OPENTABLE", "OpenTable"),
  CUSTOM: new GenericHmacAdapter("CUSTOM", "Custom HTTP"),
};

export function adapterFor(kind: ConnectorKind): ConnectorAdapter {
  return ADAPTERS[kind] ?? ADAPTERS.CUSTOM;
}

// HMAC SHA-256 compare with constant-time check. Used in the webhook ingest
// route where we have access to the raw body string.
export function verifyHmac(rawBody: string, signature: string, secret: string): boolean {
  if (!signature || !secret) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  const provided = signature.replace(/^sha256=/, "").toLowerCase();
  if (provided.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  } catch {
    return false;
  }
}
