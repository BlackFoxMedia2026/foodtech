import { z } from "zod";
import { db } from "@/lib/db";

const COST_CATEGORIES = [
  "FOOD",
  "BEVERAGE",
  "STAFF",
  "RENT",
  "UTILITIES",
  "MARKETING",
  "SUPPLIES",
  "OTHER",
] as const;

export const CostEntryInput = z.object({
  category: z.enum(COST_CATEGORIES),
  label: z.string().min(2).max(120),
  amountCents: z.coerce.number().int().min(0),
  occurredOn: z.coerce.date(),
  recurring: z.coerce.boolean().optional(),
});

export const StaffShiftInput = z.object({
  staffName: z.string().min(2).max(80),
  role: z.string().max(40).optional().nullable(),
  date: z.coerce.date(),
  hours: z.coerce.number().min(0).max(24),
  hourlyCents: z.coerce.number().int().min(0),
  notes: z.string().max(400).optional().nullable(),
});

export const MenuItemCostInput = z.object({
  menuItemId: z.string(),
  costCents: z.coerce.number().int().min(0),
});

export async function listCosts(venueId: string, sinceDays = 30) {
  const since = new Date(Date.now() - sinceDays * 86400_000);
  return db.costEntry.findMany({
    where: { venueId, occurredOn: { gte: since } },
    orderBy: { occurredOn: "desc" },
    take: 200,
  });
}

export async function createCost(venueId: string, raw: unknown, userId: string | null) {
  const data = CostEntryInput.parse(raw);
  return db.costEntry.create({
    data: {
      venueId,
      category: data.category,
      label: data.label,
      amountCents: data.amountCents,
      occurredOn: data.occurredOn,
      recurring: data.recurring ?? false,
      createdBy: userId,
    },
  });
}

export async function deleteCost(venueId: string, id: string) {
  const existing = await db.costEntry.findFirst({ where: { id, venueId } });
  if (!existing) throw new Error("not_found");
  await db.costEntry.delete({ where: { id } });
}

export async function listShifts(venueId: string, sinceDays = 30) {
  const since = new Date(Date.now() - sinceDays * 86400_000);
  return db.staffShift.findMany({
    where: { venueId, date: { gte: since } },
    orderBy: { date: "desc" },
    take: 200,
  });
}

export async function createShift(venueId: string, raw: unknown) {
  const data = StaffShiftInput.parse(raw);
  return db.staffShift.create({
    data: {
      venueId,
      staffName: data.staffName,
      role: data.role ?? null,
      date: data.date,
      hours: data.hours,
      hourlyCents: data.hourlyCents,
      notes: data.notes ?? null,
    },
  });
}

export async function deleteShift(venueId: string, id: string) {
  const existing = await db.staffShift.findFirst({ where: { id, venueId } });
  if (!existing) throw new Error("not_found");
  await db.staffShift.delete({ where: { id } });
}

export async function setMenuItemCost(venueId: string, raw: unknown) {
  const data = MenuItemCostInput.parse(raw);
  // Make sure the item belongs to the venue
  const item = await db.menuItem.findFirst({
    where: { id: data.menuItemId, venueId },
    select: { id: true },
  });
  if (!item) throw new Error("not_found");
  return db.menuItemCost.upsert({
    where: { menuItemId: data.menuItemId },
    update: { costCents: data.costCents },
    create: { venueId, menuItemId: data.menuItemId, costCents: data.costCents },
  });
}

export async function listMenuItemCosts(venueId: string) {
  return db.menuItemCost.findMany({ where: { venueId } });
}

export async function financeOverview(venueId: string, days = 30) {
  const since = new Date(Date.now() - days * 86400_000);
  const [costs, shifts, orders] = await Promise.all([
    db.costEntry.findMany({
      where: { venueId, occurredOn: { gte: since } },
      select: { category: true, amountCents: true },
    }),
    db.staffShift.findMany({
      where: { venueId, date: { gte: since } },
      select: { hours: true, hourlyCents: true },
    }),
    db.order.findMany({
      where: { venueId, status: "COMPLETED", completedAt: { gte: since } },
      select: { totalCents: true },
    }),
  ]);

  const costsByCategory = costs.reduce<Record<string, number>>((acc, c) => {
    acc[c.category] = (acc[c.category] ?? 0) + c.amountCents;
    return acc;
  }, {});
  const totalCosts = costs.reduce((s, c) => s + c.amountCents, 0);
  const totalLaborCents = shifts.reduce(
    (s, sh) => s + Math.round(sh.hours * sh.hourlyCents),
    0,
  );
  const totalRevenueCents = orders.reduce((s, o) => s + o.totalCents, 0);

  const grossMarginCents = totalRevenueCents - totalCosts - totalLaborCents;
  const marginRate =
    totalRevenueCents > 0
      ? Math.round((grossMarginCents / totalRevenueCents) * 100)
      : 0;
  const foodCostRate =
    totalRevenueCents > 0
      ? Math.round((((costsByCategory.FOOD ?? 0) + (costsByCategory.BEVERAGE ?? 0)) / totalRevenueCents) * 100)
      : 0;
  const laborCostRate =
    totalRevenueCents > 0
      ? Math.round((totalLaborCents / totalRevenueCents) * 100)
      : 0;

  return {
    totalCostsCents: totalCosts,
    totalLaborCents,
    totalRevenueCents,
    grossMarginCents,
    marginRate,
    foodCostRate,
    laborCostRate,
    costsByCategory,
  };
}
