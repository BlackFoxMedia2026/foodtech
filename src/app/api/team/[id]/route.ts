import { NextResponse } from "next/server";
import { z } from "zod";
import { can, getActiveVenue } from "@/lib/tenant";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const Patch = z.object({
  role: z.enum(["MANAGER", "RECEPTION", "WAITER", "MARKETING", "READ_ONLY"]),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "manage_venue")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const existing = await db.venueMembership.findFirst({
    where: { id: params.id, venueId: ctx.venueId },
  });
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (existing.userId === ctx.userId) {
    return NextResponse.json({ error: "cant_edit_self" }, { status: 409 });
  }
  try {
    const body = Patch.parse(await req.json());
    const updated = await db.venueMembership.update({
      where: { id: params.id },
      data: { role: body.role },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "manage_venue")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const existing = await db.venueMembership.findFirst({
    where: { id: params.id, venueId: ctx.venueId },
  });
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (existing.userId === ctx.userId) {
    return NextResponse.json({ error: "cant_remove_self" }, { status: 409 });
  }
  await db.venueMembership.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
