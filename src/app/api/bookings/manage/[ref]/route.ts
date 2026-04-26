import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  cancelBookingByReference,
  getBookingByReference,
  updateBookingByReference,
} from "@/server/booking-self-service";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { ref: string } }) {
  const booking = await getBookingByReference(params.ref);
  if (!booking) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({
    reference: booking.reference,
    status: booking.status,
    startsAt: booking.startsAt,
    partySize: booking.partySize,
    notes: booking.notes,
    guest: booking.guest,
    venue: booking.venue,
  });
}

export async function PATCH(req: Request, { params }: { params: { ref: string } }) {
  const limited = rateLimit(req, { key: `manage:${params.ref}`, max: 8, windowMs: 60_000 });
  if (!limited.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  try {
    const body = await req.json();
    const updated = await updateBookingByReference(params.ref, body);
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "invalid_input", issues: err.issues }, { status: 400 });
    }
    const code = err instanceof Error ? err.message : "unknown";
    const status =
      code === "not_found"
        ? 404
        : code === "locked" || code === "already_closed"
          ? 409
          : code === "too_late"
            ? 403
            : code === "slot_unavailable"
              ? 409
              : 400;
    return NextResponse.json({ error: code }, { status });
  }
}

export async function DELETE(req: Request, { params }: { params: { ref: string } }) {
  const limited = rateLimit(req, { key: `manage:${params.ref}`, max: 4, windowMs: 60_000 });
  if (!limited.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const reason = new URL(req.url).searchParams.get("reason") ?? undefined;
  try {
    const updated = await cancelBookingByReference(params.ref, reason ?? undefined);
    return NextResponse.json(updated);
  } catch (err) {
    const code = err instanceof Error ? err.message : "unknown";
    const status =
      code === "not_found"
        ? 404
        : code === "already_closed" || code === "too_late"
          ? 409
          : 400;
    return NextResponse.json({ error: code }, { status });
  }
}
