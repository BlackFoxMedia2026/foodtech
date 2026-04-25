import { NextResponse } from "next/server";
import { can, getActiveVenue, sanitizeGuest } from "@/lib/tenant";
import { getGuest, updateGuest } from "@/server/guests";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getActiveVenue();
  const item = await getGuest(ctx.venueId, params.id);
  if (!item) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(sanitizeGuest(item as unknown as Record<string, unknown>, ctx.role));
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getActiveVenue();
  try {
    const body = await req.json();
    if (!can(ctx.role, "view_private") && body && typeof body === "object" && "privateNotes" in body) {
      delete (body as Record<string, unknown>).privateNotes;
    }
    const updated = await updateGuest(ctx.venueId, params.id, body);
    return NextResponse.json(sanitizeGuest(updated as unknown as Record<string, unknown>, ctx.role));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "invalid" }, { status: 400 });
  }
}
