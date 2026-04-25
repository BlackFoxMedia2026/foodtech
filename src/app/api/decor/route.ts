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

const Body = z.object({
  kind: KIND,
  label: z.string().max(40).optional().nullable(),
  posX: z.coerce.number().int().default(40),
  posY: z.coerce.number().int().default(40),
  width: z.coerce.number().int().min(20).max(800).default(80),
  height: z.coerce.number().int().min(20).max(800).default(80),
  rotation: z.coerce.number().int().default(0),
  color: z.string().max(20).optional().nullable(),
  roomId: z.string().optional().nullable(),
});

export async function GET() {
  const ctx = await getActiveVenue();
  const items = await db.floorDecor.findMany({
    where: { venueId: ctx.venueId },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const ctx = await getActiveVenue();
  try {
    const data = Body.parse(await req.json());
    const created = await db.floorDecor.create({ data: { ...data, venueId: ctx.venueId } });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "invalid" }, { status: 400 });
  }
}
