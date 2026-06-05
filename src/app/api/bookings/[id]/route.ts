import { NextResponse } from "next/server";
import { can, getActiveVenue, sanitizeBooking, sanitizeGuest } from "@/lib/tenant";
import { db } from "@/lib/db";
import { updateBooking } from "@/server/bookings";
import { softDeleteBooking } from "@/server/soft-delete";

function clean(b: Record<string, unknown>, role: Parameters<typeof can>[0]) {
  const safe = sanitizeBooking(b, role);
  if (safe.guest && typeof safe.guest === "object") {
    safe.guest = sanitizeGuest(safe.guest as Record<string, unknown>, role);
  }
  return safe;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getActiveVenue();
  const item = await db.booking.findFirst({
    where: { id: params.id, venueId: ctx.venueId },
    include: { guest: true, table: true, payments: true },
  });
  if (!item) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(clean(item as unknown as Record<string, unknown>, ctx.role));
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getActiveVenue();
  try {
    const body = await req.json();
    if (!can(ctx.role, "view_private") && body && typeof body === "object" && "internalNotes" in body) {
      delete (body as Record<string, unknown>).internalNotes;
    }
    const updated = await updateBooking(ctx.venueId, params.id, body, { actorId: ctx.userId });
    return NextResponse.json(clean(updated as unknown as Record<string, unknown>, ctx.role));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "invalid" }, { status: 400 });
  }
}

/**
 * GDPR: NON hard-delete. Soft-delete + audit log; manager può ripristinare
 * entro 30 giorni via POST /api/bookings/[id]/restore.
 */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "manage_bookings")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    await softDeleteBooking(ctx.venueId, params.id, ctx.userId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
}
