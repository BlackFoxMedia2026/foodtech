import { NextResponse } from "next/server";
import { z } from "zod";
import { can, getActiveVenue } from "@/lib/tenant";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const Input = z.object({
  blocked: z.coerce.boolean(),
  reason: z.string().max(400).optional().nullable(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "manage_bookings")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const parsed = Input.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  const guest = await db.guest.findFirst({
    where: { id: params.id, venueId: ctx.venueId },
    select: { id: true },
  });
  if (!guest) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const updated = await db.guest.update({
    where: { id: guest.id },
    data: parsed.data.blocked
      ? {
          blocked: true,
          blockedAt: new Date(),
          blockedReason: parsed.data.reason ?? "Bloccato dallo staff",
        }
      : { blocked: false, blockedAt: null, blockedReason: null },
  });
  return NextResponse.json(updated);
}
