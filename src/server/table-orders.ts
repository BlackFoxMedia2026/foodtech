import { z } from "zod";
import { db } from "@/lib/db";

// Table-side ordering: the guest sits at a table, scans the QR with the
// table label, picks items from the live menu and submits. We create an
// Order with kind=TABLE so the kitchen display surfaces it. Payment
// happens with the waiter at the till — we don't collect contact info or
// money at this stage.

export const TableOrderInput = z.object({
  items: z
    .array(
      z.object({
        menuItemId: z.string(),
        quantity: z.coerce.number().int().min(1).max(20),
        notes: z.string().max(200).optional().nullable(),
      }),
    )
    .min(1)
    .max(40),
  notes: z.string().max(500).optional().nullable(),
  customerName: z.string().max(80).optional().nullable(),
});

export type TableOrderInputType = z.infer<typeof TableOrderInput>;

export async function createTableOrder(
  venueSlug: string,
  tableLabel: string,
  raw: unknown,
) {
  const data = TableOrderInput.parse(raw);
  const venue = await db.venue.findFirst({
    where: { slug: venueSlug, active: true },
    select: { id: true, currency: true },
  });
  if (!venue) throw new Error("venue_not_found");

  const decoded = decodeURIComponent(tableLabel);
  const table = await db.table.findFirst({
    where: { venueId: venue.id, label: decoded, active: true },
    select: { id: true, label: true },
  });
  if (!table) throw new Error("table_not_found");

  const ids = data.items.map((i) => i.menuItemId);
  const real = await db.menuItem.findMany({
    where: { id: { in: ids }, venueId: venue.id, available: true },
  });
  const realMap = new Map(real.map((m) => [m.id, m]));

  const items = data.items
    .map((it) => {
      const ref = realMap.get(it.menuItemId);
      if (!ref) return null;
      return {
        menuItemId: ref.id,
        name: ref.name,
        priceCents: ref.priceCents,
        quantity: it.quantity,
        notes: it.notes ?? null,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  if (items.length === 0) throw new Error("empty_items");

  const totalCents = items.reduce((s, i) => s + i.priceCents * i.quantity, 0);

  return db.order.create({
    data: {
      venueId: venue.id,
      kind: "TABLE",
      status: "RECEIVED",
      paymentStatus: "PENDING",
      customerName: data.customerName?.trim() || `Tavolo ${table.label}`,
      phone: "",
      tableLabel: table.label,
      scheduledAt: new Date(),
      totalCents,
      currency: venue.currency,
      notes: data.notes ?? null,
      items: { create: items },
    },
    include: { items: true },
  });
}

export async function getTableMenu(venueSlug: string, tableLabel: string) {
  const venue = await db.venue.findFirst({
    where: { slug: venueSlug, active: true },
    select: {
      id: true,
      name: true,
      currency: true,
      slug: true,
    },
  });
  if (!venue) return null;
  const decoded = decodeURIComponent(tableLabel);
  const table = await db.table.findFirst({
    where: { venueId: venue.id, label: decoded, active: true },
    select: { id: true, label: true },
  });
  if (!table) return null;
  const categories = await db.menuCategory.findMany({
    where: { venueId: venue.id, active: true },
    orderBy: [{ ordering: "asc" }, { createdAt: "asc" }],
    include: {
      items: {
        where: { available: true },
        orderBy: { ordering: "asc" },
        select: {
          id: true,
          name: true,
          description: true,
          priceCents: true,
          currency: true,
          allergens: true,
          dietary: true,
        },
      },
    },
  });
  return { venue, table, categories };
}
