import { z } from "zod";
import { db } from "@/lib/db";

export const BlockInput = z.object({
  tableId: z.string(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  reason: z.string().max(200).optional().nullable(),
});

export type BlockInputType = z.infer<typeof BlockInput>;

export async function listActiveBlocks(venueId: string) {
  const now = new Date();
  return db.tableBlock.findMany({
    where: { venueId, endsAt: { gte: now } },
    orderBy: { startsAt: "asc" },
    include: {
      table: { select: { id: true, label: true, seats: true } },
    },
  });
}

export async function createBlock(venueId: string, raw: unknown) {
  const data = BlockInput.parse(raw);
  if (data.endsAt <= data.startsAt) throw new Error("invalid_range");
  const table = await db.table.findFirst({ where: { id: data.tableId, venueId } });
  if (!table) throw new Error("invalid_table");
  return db.tableBlock.create({
    data: {
      venueId,
      tableId: data.tableId,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      reason: data.reason ?? null,
    },
    include: {
      table: { select: { id: true, label: true, seats: true } },
    },
  });
}

export async function deleteBlock(venueId: string, id: string) {
  const existing = await db.tableBlock.findFirst({ where: { id, venueId } });
  if (!existing) throw new Error("not_found");
  await db.tableBlock.delete({ where: { id } });
}
