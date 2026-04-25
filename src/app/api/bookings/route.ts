import { NextResponse } from "next/server";
import { can, getActiveVenue, sanitizeBooking, sanitizeGuest } from "@/lib/tenant";
import { createBooking, listBookingsForDay } from "@/server/bookings";

function clean(b: Record<string, unknown>, role: Parameters<typeof can>[0]) {
  const safe = sanitizeBooking(b, role);
  if (safe.guest && typeof safe.guest === "object") {
    safe.guest = sanitizeGuest(safe.guest as Record<string, unknown>, role);
  }
  return safe;
}

export async function GET(req: Request) {
  const ctx = await getActiveVenue();
  const url = new URL(req.url);
  const day = url.searchParams.get("day");
  const target = day ? new Date(day) : new Date();
  const data = await listBookingsForDay(ctx.venueId, target);
  return NextResponse.json(data.map((b) => clean(b as unknown as Record<string, unknown>, ctx.role)));
}

export async function POST(req: Request) {
  const ctx = await getActiveVenue();
  try {
    const body = await req.json();
    if (!can(ctx.role, "view_private") && body && typeof body === "object" && "internalNotes" in body) {
      delete (body as Record<string, unknown>).internalNotes;
    }
    const created = await createBooking(ctx.venueId, body);
    return NextResponse.json(clean(created as unknown as Record<string, unknown>, ctx.role), { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "invalid" }, { status: 400 });
  }
}
