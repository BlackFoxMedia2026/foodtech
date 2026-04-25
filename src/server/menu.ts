import { z } from "zod";
import { db } from "@/lib/db";

export const ALLERGENS = [
  "GLUTEN",
  "DAIRY",
  "EGGS",
  "NUTS",
  "PEANUTS",
  "FISH",
  "SHELLFISH",
  "SOY",
  "CELERY",
  "MUSTARD",
  "SESAME",
  "SULPHITES",
  "LUPIN",
  "MOLLUSCS",
] as const;

export const DIETARY = [
  "VEGETARIAN",
  "VEGAN",
  "GLUTEN_FREE",
  "LACTOSE_FREE",
  "HALAL",
  "KOSHER",
] as const;

export const ALLERGEN_LABEL: Record<(typeof ALLERGENS)[number], string> = {
  GLUTEN: "Glutine",
  DAIRY: "Latte",
  EGGS: "Uova",
  NUTS: "Frutta a guscio",
  PEANUTS: "Arachidi",
  FISH: "Pesce",
  SHELLFISH: "Crostacei",
  SOY: "Soia",
  CELERY: "Sedano",
  MUSTARD: "Senape",
  SESAME: "Sesamo",
  SULPHITES: "Solfiti",
  LUPIN: "Lupini",
  MOLLUSCS: "Molluschi",
};

export const DIETARY_LABEL: Record<(typeof DIETARY)[number], string> = {
  VEGETARIAN: "Vegetariano",
  VEGAN: "Vegano",
  GLUTEN_FREE: "Senza glutine",
  LACTOSE_FREE: "Senza lattosio",
  HALAL: "Halal",
  KOSHER: "Kosher",
};

export const CategoryInput = z.object({
  name: z.string().min(1).max(80),
  menuKey: z.string().max(40).default("main"),
  ordering: z.coerce.number().int().min(0).max(1000).default(0),
  active: z.boolean().optional(),
});

export const ItemInput = z.object({
  categoryId: z.string(),
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional().nullable(),
  priceCents: z.coerce.number().int().min(0).max(1_000_000).default(0),
  currency: z.string().length(3).default("EUR"),
  available: z.boolean().optional(),
  ordering: z.coerce.number().int().min(0).max(1000).default(0),
  allergens: z.array(z.enum(ALLERGENS)).default([]),
  dietary: z.array(z.enum(DIETARY)).default([]),
  imageUrl: z.string().url().optional().nullable().or(z.literal("")),
});

export async function listMenu(venueId: string, menuKey?: string) {
  const categories = await db.menuCategory.findMany({
    where: { venueId, ...(menuKey ? { menuKey } : {}), active: true },
    orderBy: [{ ordering: "asc" }, { name: "asc" }],
    include: {
      items: {
        where: { available: true },
        orderBy: [{ ordering: "asc" }, { name: "asc" }],
      },
    },
  });
  return categories;
}

export async function listMenuKeys(venueId: string) {
  const rows = await db.menuCategory.findMany({
    where: { venueId },
    select: { menuKey: true },
    distinct: ["menuKey"],
  });
  return rows.map((r) => r.menuKey).sort();
}

export async function listAdminMenu(venueId: string, menuKey: string) {
  return db.menuCategory.findMany({
    where: { venueId, menuKey },
    orderBy: [{ ordering: "asc" }, { name: "asc" }],
    include: {
      items: { orderBy: [{ ordering: "asc" }, { name: "asc" }] },
    },
  });
}

export async function createCategory(venueId: string, raw: unknown) {
  const data = CategoryInput.parse(raw);
  return db.menuCategory.create({ data: { ...data, venueId } });
}

export async function updateCategory(venueId: string, id: string, raw: unknown) {
  const existing = await db.menuCategory.findFirst({ where: { id, venueId } });
  if (!existing) throw new Error("not_found");
  const data = CategoryInput.partial().parse(raw);
  return db.menuCategory.update({
    where: { id },
    data,
  });
}

export async function deleteCategory(venueId: string, id: string) {
  const existing = await db.menuCategory.findFirst({ where: { id, venueId } });
  if (!existing) throw new Error("not_found");
  await db.menuCategory.delete({ where: { id } });
}

export async function createItem(venueId: string, raw: unknown) {
  const data = ItemInput.parse(raw);
  const category = await db.menuCategory.findFirst({ where: { id: data.categoryId, venueId } });
  if (!category) throw new Error("invalid_category");
  return db.menuItem.create({
    data: {
      venueId,
      categoryId: data.categoryId,
      name: data.name,
      description: data.description ?? null,
      priceCents: data.priceCents,
      currency: data.currency,
      available: data.available ?? true,
      ordering: data.ordering,
      allergens: data.allergens,
      dietary: data.dietary,
      imageUrl: data.imageUrl || null,
    },
  });
}

export async function updateItem(venueId: string, id: string, raw: unknown) {
  const existing = await db.menuItem.findFirst({ where: { id, venueId } });
  if (!existing) throw new Error("not_found");
  const data = ItemInput.partial().parse(raw);
  return db.menuItem.update({
    where: { id },
    data: {
      categoryId: data.categoryId ?? undefined,
      name: data.name ?? undefined,
      description: data.description === undefined ? undefined : data.description ?? null,
      priceCents: data.priceCents ?? undefined,
      currency: data.currency ?? undefined,
      available: data.available ?? undefined,
      ordering: data.ordering ?? undefined,
      allergens: data.allergens ?? undefined,
      dietary: data.dietary ?? undefined,
      imageUrl: data.imageUrl === undefined ? undefined : data.imageUrl || null,
    },
  });
}

export async function deleteItem(venueId: string, id: string) {
  const existing = await db.menuItem.findFirst({ where: { id, venueId } });
  if (!existing) throw new Error("not_found");
  await db.menuItem.delete({ where: { id } });
}
