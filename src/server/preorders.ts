import { z } from "zod";
import { db } from "@/lib/db";

// Pre-order: a guest (or staff on their behalf) picks the menu items
// they'd like to enjoy at the table before the booking starts. The total
// is informational here — staff can convert it into an Order at the till
// or use it to plan the kitchen.

const ItemInput = z.object({
  menuItemId: z.string().optional().nullable(),
  name: z.string().min(1).max(120),
  priceCents: z.coerce.number().int().min(0),
  quantity: z.coerce.number().int().min(1).max(50),
  notes: z.string().max(200).optional().nullable(),
});

export const PreorderInput = z.object({
  status: z.enum(["DRAFT", "CONFIRMED", "PREPARED", "CANCELLED"]).optional(),
  notes: z.string().max(500).optional().nullable(),
  items: z.array(ItemInput).max(50),
});

const VENUE_INCLUDE = {
  items: { orderBy: { id: "asc" as const } },
  booking: {
    select: {
      id: true,
      reference: true,
      venueId: true,
      partySize: true,
      startsAt: true,
    },
  },
} as const;

export async function getPreorderForBooking(bookingId: string) {
  return db.bookingPreorder.findUnique({
    where: { bookingId },
    include: VENUE_INCLUDE,
  });
}

export async function getPreorderForReference(reference: string) {
  const booking = await db.booking.findUnique({
    where: { reference },
    select: { id: true },
  });
  if (!booking) return null;
  return getPreorderForBooking(booking.id);
}

export async function savePreorderForBooking(
  venueId: string,
  bookingId: string,
  raw: unknown,
) {
  const data = PreorderInput.parse(raw);
  const booking = await db.booking.findFirst({
    where: { id: bookingId, venueId },
    select: { id: true },
  });
  if (!booking) throw new Error("not_found");
  return upsertPreorder(booking.id, data);
}

export async function savePreorderForReference(reference: string, raw: unknown) {
  const data = PreorderInput.parse(raw);
  const booking = await db.booking.findUnique({
    where: { reference },
    select: { id: true, status: true, startsAt: true },
  });
  if (!booking) throw new Error("not_found");
  if (
    booking.status === "COMPLETED" ||
    booking.status === "CANCELLED" ||
    booking.status === "NO_SHOW"
  )
    throw new Error("locked");
  // Disable guest edits within 2h before service so the kitchen has time.
  if (booking.startsAt.getTime() - Date.now() < 2 * 60 * 60 * 1000)
    throw new Error("too_late");
  return upsertPreorder(booking.id, data);
}

async function upsertPreorder(
  bookingId: string,
  data: z.infer<typeof PreorderInput>,
) {
  const totalCents = data.items.reduce(
    (sum, it) => sum + it.priceCents * it.quantity,
    0,
  );
  return db.$transaction(async (tx) => {
    const existing = await tx.bookingPreorder.findUnique({ where: { bookingId } });
    const preorder = existing
      ? await tx.bookingPreorder.update({
          where: { bookingId },
          data: {
            status: data.status ?? existing.status,
            notes: data.notes ?? null,
            totalCents,
          },
        })
      : await tx.bookingPreorder.create({
          data: {
            bookingId,
            status: data.status ?? "DRAFT",
            notes: data.notes ?? null,
            totalCents,
          },
        });
    await tx.bookingPreorderItem.deleteMany({ where: { preorderId: preorder.id } });
    if (data.items.length > 0) {
      await tx.bookingPreorderItem.createMany({
        data: data.items.map((it) => ({
          preorderId: preorder.id,
          menuItemId: it.menuItemId ?? null,
          name: it.name,
          priceCents: it.priceCents,
          quantity: it.quantity,
          notes: it.notes ?? null,
        })),
      });
    }
    return tx.bookingPreorder.findUnique({
      where: { id: preorder.id },
      include: { items: true },
    });
  });
}

export async function venueMenuForPreorder(venueId: string) {
  return db.menuCategory.findMany({
    where: { venueId, active: true },
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
          dietary: true,
          allergens: true,
        },
      },
    },
  });
}
