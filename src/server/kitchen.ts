import { db } from "@/lib/db";

// Kitchen Display System data layer. We don't introduce a new model: the
// kitchen view is just a projection over Order (asporto/delivery) and
// BookingPreorder (in-house tasting menus / group bookings). Everything in
// this file is a read-only aggregator, since the status mutations already
// live in their own routes.

export type KitchenTicket = {
  id: string;
  source: "ORDER" | "PREORDER";
  reference: string;
  status: string;
  customerName: string;
  partyOrSize: number;
  notes: string | null;
  scheduledAt: Date;
  totalCents: number;
  currency: string;
  items: { id: string; name: string; quantity: number; notes: string | null }[];
  bookingId?: string;
  orderId?: string;
  pickupOrTable?: string | null;
};

const ACTIVE_ORDER_STATUSES = ["RECEIVED", "PREPARING", "READY", "ON_THE_WAY"] as const;
const ACTIVE_PREORDER_STATUSES = ["DRAFT", "CONFIRMED", "PREPARED"] as const;

export async function kitchenTickets(venueId: string): Promise<KitchenTicket[]> {
  const since = new Date();
  since.setHours(since.getHours() - 2);
  const ahead = new Date();
  ahead.setHours(ahead.getHours() + 18);

  const [orders, preorders] = await Promise.all([
    db.order.findMany({
      where: {
        venueId,
        status: { in: [...ACTIVE_ORDER_STATUSES] },
        scheduledAt: { gte: since, lte: ahead },
      },
      orderBy: { scheduledAt: "asc" },
      include: { items: true },
      take: 200,
    }),
    db.bookingPreorder.findMany({
      where: {
        booking: { venueId, startsAt: { gte: since, lte: ahead } },
        status: { in: [...ACTIVE_PREORDER_STATUSES] },
      },
      orderBy: { createdAt: "desc" },
      include: {
        items: true,
        booking: {
          include: {
            guest: { select: { firstName: true, lastName: true } },
            table: { select: { label: true } },
          },
        },
      },
      take: 200,
    }),
  ]);

  const orderTickets: KitchenTicket[] = orders.map((o) => ({
    id: `order-${o.id}`,
    source: "ORDER",
    reference: o.reference.slice(-8).toUpperCase(),
    status: o.status,
    customerName: o.customerName,
    partyOrSize: 1,
    notes: o.notes,
    scheduledAt: o.scheduledAt,
    totalCents: o.totalCents,
    currency: o.currency,
    items: o.items.map((i) => ({
      id: i.id,
      name: i.name,
      quantity: i.quantity,
      notes: i.notes,
    })),
    orderId: o.id,
    pickupOrTable: o.kind === "DELIVERY" ? "Consegna" : "Ritiro",
  }));

  const preorderTickets: KitchenTicket[] = preorders
    .filter((p) => p.items.length > 0)
    .map((p) => ({
      id: `preorder-${p.id}`,
      source: "PREORDER",
      reference: p.booking.reference.slice(-8).toUpperCase(),
      status: p.status,
      customerName: p.booking.guest
        ? `${p.booking.guest.firstName}${p.booking.guest.lastName ? " " + p.booking.guest.lastName : ""}`
        : "Sala",
      partyOrSize: p.booking.partySize,
      notes: p.notes,
      scheduledAt: p.booking.startsAt,
      totalCents: p.totalCents,
      currency: "EUR",
      items: p.items.map((i) => ({
        id: i.id,
        name: i.name,
        quantity: i.quantity,
        notes: i.notes,
      })),
      bookingId: p.bookingId,
      pickupOrTable: p.booking.table?.label ?? "Tavolo da assegnare",
    }));

  return [...preorderTickets, ...orderTickets].sort(
    (a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime(),
  );
}

export type KitchenSummary = {
  total: number;
  bySource: { ORDER: number; PREORDER: number };
  byStatus: Record<string, number>;
  earliestAt: Date | null;
};

export function summariseTickets(tickets: KitchenTicket[]): KitchenSummary {
  const bySource = { ORDER: 0, PREORDER: 0 };
  const byStatus: Record<string, number> = {};
  let earliest: Date | null = null;
  for (const t of tickets) {
    bySource[t.source]++;
    byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
    if (!earliest || t.scheduledAt < earliest) earliest = t.scheduledAt;
  }
  return { total: tickets.length, bySource, byStatus, earliestAt: earliest };
}
