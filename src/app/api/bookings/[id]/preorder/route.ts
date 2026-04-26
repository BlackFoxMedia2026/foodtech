import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { can, getActiveVenue } from "@/lib/tenant";
import { getPreorderForBooking, savePreorderForBooking } from "@/server/preorders";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "manage_bookings")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const preorder = await getPreorderForBooking(params.id);
  if (!preorder || preorder.booking.venueId !== ctx.venueId) {
    return NextResponse.json(null);
  }
  return NextResponse.json(preorder);
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "manage_bookings")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const updated = await savePreorderForBooking(ctx.venueId, params.id, body);
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "invalid_input", issues: err.issues }, { status: 400 });
    }
    const code = err instanceof Error ? err.message : "invalid";
    return NextResponse.json({ error: code }, { status: code === "not_found" ? 404 : 400 });
  }
}
