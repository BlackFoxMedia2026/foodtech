import { z } from "zod";
import { db } from "@/lib/db";

export const ShiftInput = z.object({
  name: z.string().min(1).max(60),
  weekday: z.coerce.number().int().min(0).max(6),
  startMinute: z.coerce.number().int().min(0).max(1439),
  endMinute: z.coerce.number().int().min(1).max(1439),
  capacity: z.coerce.number().int().min(1).max(2000),
  slotMinutes: z.coerce.number().int().min(5).max(120),
  active: z.boolean().optional(),
});

export type ShiftInputType = z.infer<typeof ShiftInput>;

export async function listShifts(venueId: string) {
  return db.shift.findMany({
    where: { venueId },
    orderBy: [{ weekday: "asc" }, { startMinute: "asc" }],
  });
}

export async function createShift(venueId: string, raw: unknown) {
  const data = ShiftInput.parse(raw);
  if (data.endMinute <= data.startMinute) throw new Error("invalid_range");
  return db.shift.create({
    data: {
      venueId,
      name: data.name,
      weekday: data.weekday,
      startMinute: data.startMinute,
      endMinute: data.endMinute,
      capacity: data.capacity,
      slotMinutes: data.slotMinutes,
      active: data.active ?? true,
    },
  });
}

export async function updateShift(venueId: string, id: string, raw: unknown) {
  const existing = await db.shift.findFirst({ where: { id, venueId } });
  if (!existing) throw new Error("not_found");
  const data = ShiftInput.partial().parse(raw);
  if (data.startMinute !== undefined && data.endMinute !== undefined && data.endMinute <= data.startMinute) {
    throw new Error("invalid_range");
  }
  return db.shift.update({ where: { id }, data });
}

export async function deleteShift(venueId: string, id: string) {
  const existing = await db.shift.findFirst({ where: { id, venueId } });
  if (!existing) throw new Error("not_found");
  await db.shift.delete({ where: { id } });
}
