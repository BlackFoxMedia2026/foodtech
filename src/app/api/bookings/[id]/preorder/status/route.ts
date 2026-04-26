import { NextResponse } from "next/server";
import { z } from "zod";
import { can, getActiveVenue } from "@/lib/tenant";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const Input = z.object({
  status: z.enum(["DRAFT", "CONFIRMED", "PREPARED", "CANCELLED"]),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "manage_bookings")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const parsed = Input.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  const preorder = await db.bookingPreorder.findFirst({
    where: { bookingId: params.id, booking: { venueId: ctx.venueId } },
  });
  if (!preorder) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const updated = await db.bookingPreorder.update({
    where: { id: preorder.id },
    data: { status: parsed.data.status },
  });
  return NextResponse.json(updated);
}
