import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { getActiveVenue } from "@/lib/tenant";
import { listOrdersToday } from "@/server/orders";
import { OrdersBoard } from "@/components/orders/orders-board";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const ctx = await getActiveVenue();
  const orders = await listOrdersToday(ctx.venueId);

  const today = orders.length;
  const open = orders.filter((o) => !["COMPLETED", "CANCELLED"].includes(o.status)).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Cucina</p>
          <h1 className="text-display text-3xl">Asporto & Delivery</h1>
          <p className="text-sm text-muted-foreground">
            {open} ordini aperti · {today} totali oggi
          </p>
        </div>
        <Link
          href={`/order/${ctx.venue.slug}`}
          target="_blank"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          Apri menu ordini pubblico <ExternalLink className="h-3 w-3" />
        </Link>
      </header>

      <OrdersBoard
        currency={ctx.venue.currency}
        initial={orders.map((o) => ({
          id: o.id,
          reference: o.reference,
          kind: o.kind,
          status: o.status,
          customerName: o.customerName,
          phone: o.phone,
          email: o.email,
          address: o.address,
          scheduledAt: o.scheduledAt.toISOString(),
          totalCents: o.totalCents,
          notes: o.notes,
          items: o.items.map((it) => ({
            id: it.id,
            name: it.name,
            priceCents: it.priceCents,
            quantity: it.quantity,
            notes: it.notes,
          })),
        }))}
      />
    </div>
  );
}
