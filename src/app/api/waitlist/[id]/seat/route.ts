import { NextResponse } from "next/server";
import { getActiveVenue } from "@/lib/tenant";
import { convertToBooking } from "@/server/waitlist";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getActiveVenue();
  let body: { tableId?: string | null } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  try {
    const booking = await convertToBooking(ctx.venueId, params.id, {
      tableId: body.tableId ?? null,
    });
    return NextResponse.json(booking);
  } catch (err) {
    const code = err instanceof Error ? err.message : "invalid";
    return NextResponse.json({ error: code }, { status: code === "not_found" ? 404 : 400 });
  }
}
