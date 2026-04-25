import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getActiveVenue } from "@/lib/tenant";

const KIND = z.enum([
  "PLANT",
  "SOFA",
  "ARMCHAIR",
  "BAR",
  "COUNTER",
  "KITCHEN",
  "DJ_BOOTH",
  "STAGE",
  "COLUMN",
  "DIVIDER",
  "DOOR",
  "WINDOW",
  "ENTRANCE",
  "RESTROOM",
  "POOL",
  "STAIRS",
  "RUG",
  "LAMP",
  "LABEL",
]);

const Patch = z.object({
  kind: KIND.optional(),
  label: z.string().max(40).optional().nullable(),
  posX: z.coerce.number().int().optional(),
  posY: z.coerce.number().int().optional(),
  width: z.coerce.number().int().min(20).max(800).optional(),
  height: z.coerce.number().int().min(20).max(800).optional(),
  rotation: z.coerce.number().int().optional(),
  color: z.string().max(20).optional().nullable(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getActiveVenue();
  const existing = await db.floorDecor.findFirst({ where: { id: params.id, venueId: ctx.venueId } });
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });
  try {
    const data = Patch.parse(await req.json());
    const updated = await db.floorDecor.update({ where: { id: params.id }, data });
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "invalid" }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getActiveVenue();
  const existing = await db.floorDecor.findFirst({ where: { id: params.id, venueId: ctx.venueId } });
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });
  await db.floorDecor.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
