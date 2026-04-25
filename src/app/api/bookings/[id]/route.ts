import { NextResponse } from "next/server";
import { can, getActiveVenue, sanitizeBooking, sanitizeGuest } from "@/lib/tenant";
import { db } from "@/lib/db";
import { deleteBooking, updateBooking } from "@/server/bookings";

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
    const updated = await updateBooking(ctx.venueId, params.id, body);
    return NextResponse.json(clean(updated as unknown as Record<string, unknown>, ctx.role));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "invalid" }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getActiveVenue();
  try {
    await deleteBooking(ctx.venueId, params.id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
}
