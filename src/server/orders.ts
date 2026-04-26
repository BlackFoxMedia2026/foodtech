import { z } from "zod";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { sendMessage } from "@/lib/messaging";
import { fireTrigger } from "@/server/automations";
import { awardOrderPoints } from "@/server/loyalty";

export const OrderItemInput = z.object({
  menuItemId: z.string().optional(),
  name: z.string().min(1).max(120),
  priceCents: z.coerce.number().int().min(0).max(1_000_000),
  quantity: z.coerce.number().int().min(1).max(100),
  notes: z.string().max(300).optional().nullable(),
});

export const OrderInput = z.object({
  kind: z.enum(["TAKEAWAY", "DELIVERY"]).default("TAKEAWAY"),
  customerName: z.string().min(2).max(80),
  phone: z.string().min(5).max(40),
  email: z.string().email().optional().nullable().or(z.literal("")),
  address: z.string().max(300).optional().nullable(),
  scheduledAt: z.coerce.date(),
  notes: z.string().max(500).optional().nullable(),
  items: z.array(OrderItemInput).min(1).max(50),
});

export type OrderInputType = z.infer<typeof OrderInput>;

export async function listOrdersToday(venueId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  return db.order.findMany({
    where: {
      venueId,
      OR: [
        { scheduledAt: { gte: today, lt: tomorrow } },
        { status: { in: ["RECEIVED", "PREPARING", "READY", "ON_THE_WAY"] } },
      ],
    },
    orderBy: { scheduledAt: "asc" },
    include: { items: true },
  });
}

export async function getOrder(venueId: string, id: string) {
  return db.order.findFirst({
    where: { id, venueId },
    include: { items: true, guest: true },
  });
}

export async function getOrderByReference(reference: string) {
  return db.order.findUnique({
    where: { reference },
    include: {
      items: true,
      venue: { select: { name: true, slug: true, currency: true, email: true } },
    },
  });
}

export async function createOrder(venueId: string, raw: unknown) {
  const data = OrderInput.parse(raw);

  // Validate that items match real menu items (price snapshot)
  const menuIds = data.items.map((i) => i.menuItemId).filter(Boolean) as string[];
  const real = menuIds.length
    ? await db.menuItem.findMany({
        where: { id: { in: menuIds }, venueId, available: true },
      })
    : [];
  const realMap = new Map(real.map((m) => [m.id, m]));

  const items = data.items.map((it) => {
    if (it.menuItemId && realMap.has(it.menuItemId)) {
      const ref = realMap.get(it.menuItemId)!;
      return {
        menuItemId: ref.id,
        name: ref.name,
        priceCents: ref.priceCents,
        quantity: it.quantity,
        notes: it.notes ?? null,
      };
    }
    return {
      menuItemId: null,
      name: it.name,
      priceCents: it.priceCents,
      quantity: it.quantity,
      notes: it.notes ?? null,
    };
  });

  const totalCents = items.reduce((s, i) => s + i.priceCents * i.quantity, 0);

  // Try to associate / create a guest by phone
  let guestId: string | null = null;
  if (data.phone || data.email) {
    const found = await db.guest.findFirst({
      where: {
        venueId,
        OR: [
          data.email ? { email: data.email } : {},
          data.phone ? { phone: data.phone } : {},
        ].filter((c) => Object.keys(c).length > 0),
      },
    });
    if (found) {
      guestId = found.id;
    } else {
      const [first, ...rest] = data.customerName.split(" ");
      const created = await db.guest.create({
        data: {
          venueId,
          firstName: first || data.customerName,
          lastName: rest.join(" ") || null,
          email: data.email || null,
          phone: data.phone || null,
        },
      });
      guestId = created.id;
    }
  }

  const venue = await db.venue.findUnique({
    where: { id: venueId },
    select: { currency: true, name: true, email: true },
  });

  const order = await db.order.create({
    data: {
      venueId,
      guestId,
      kind: data.kind,
      customerName: data.customerName,
      phone: data.phone,
      email: data.email || null,
      address: data.address ?? null,
      scheduledAt: data.scheduledAt,
      totalCents,
      currency: venue?.currency ?? "EUR",
      notes: data.notes ?? null,
      items: {
        create: items,
      },
    },
    include: { items: true, venue: { select: { name: true, currency: true } } },
  });

  // Notify the venue (best-effort)
  if (venue?.email) {
    void sendEmail({
      to: { email: venue.email, name: venue.name },
      subject: `🛍️ Nuovo ordine ${data.kind === "DELIVERY" ? "consegna" : "ritiro"} · ${data.customerName}`,
      html: `<p>${data.customerName} ha richiesto un ordine ${data.kind} per ${order.scheduledAt.toISOString()}. Totale ${(totalCents / 100).toFixed(2)} ${order.currency}. Apri Tavolo per gestirlo.</p>`,
      text: `Nuovo ordine ${data.kind} di ${data.customerName} per ${order.scheduledAt.toISOString()}. Totale ${(totalCents / 100).toFixed(2)} ${order.currency}.`,
    });
  }

  return order;
}

const StatusUpdate = z.object({
  status: z.enum(["RECEIVED", "PREPARING", "READY", "ON_THE_WAY", "COMPLETED", "CANCELLED"]),
});

export async function updateOrderStatus(venueId: string, id: string, raw: unknown) {
  const data = StatusUpdate.parse(raw);
  const existing = await db.order.findFirst({
    where: { id, venueId },
    include: { venue: { select: { name: true } } },
  });
  if (!existing) throw new Error("not_found");
  const now = new Date();
  const updated = await db.order.update({
    where: { id },
    data: {
      status: data.status,
      preparedAt: data.status === "PREPARING" ? now : undefined,
      readyAt: data.status === "READY" ? now : undefined,
      completedAt: data.status === "COMPLETED" ? now : undefined,
      cancelledAt: data.status === "CANCELLED" ? now : undefined,
    },
  });

  if (data.status === "READY" && existing.phone) {
    const text =
      existing.kind === "DELIVERY"
        ? `Ciao ${existing.customerName.split(" ")[0]}, l'ordine da ${existing.venue.name} è in consegna.`
        : `Ciao ${existing.customerName.split(" ")[0]}, il tuo ordine ${existing.venue.name} è pronto per il ritiro!`;
    void sendMessage({ to: existing.phone, body: text, channel: "SMS" });
  }

  if (data.status === "COMPLETED" && existing.status !== "COMPLETED") {
    if (existing.guestId) {
      await awardOrderPoints({
        venueId,
        guestId: existing.guestId,
        orderId: id,
        totalCents: existing.totalCents,
      }).catch(() => undefined);
    }
    await fireTrigger("ORDER_COMPLETED", {
      venueId,
      guestId: existing.guestId ?? undefined,
      orderId: id,
      payload: { kind: existing.kind },
    }).catch(() => undefined);
  }

  return updated;
}

export async function deleteOrder(venueId: string, id: string) {
  const existing = await db.order.findFirst({ where: { id, venueId } });
  if (!existing) throw new Error("not_found");
  await db.order.delete({ where: { id } });
}

export async function listOrdersByGuestPhone(venueId: string, phone: string) {
  return db.order.findMany({
    where: { venueId, phone },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { items: true },
  });
}

export function pickupSlots(opts: { fromMin: number; toMin: number; stepMin: number; date: Date }) {
  const slots: Date[] = [];
  for (let m = opts.fromMin; m <= opts.toMin; m += opts.stepMin) {
    const d = new Date(opts.date);
    d.setHours(0, m, 0, 0);
    if (d > new Date(Date.now() + 15 * 60 * 1000)) {
      slots.push(d);
    }
  }
  return slots;
}
