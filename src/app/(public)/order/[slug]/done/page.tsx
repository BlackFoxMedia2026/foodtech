import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock, ShoppingBag, Truck } from "lucide-react";
import { getOrderByReference } from "@/server/orders";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function OrderDonePage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { ref?: string };
}) {
  if (!searchParams.ref) notFound();
  const order = await getOrderByReference(searchParams.ref);
  if (!order) notFound();

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-6 px-6 py-10 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-700">
        <CheckCircle2 className="h-7 w-7" />
      </span>
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.18em] text-gilt-dark">Ordine ricevuto</p>
        <h1 className="text-display text-3xl">
          Grazie {order.customerName.split(" ")[0]}!
        </h1>
        <p className="text-sm text-muted-foreground">
          Stiamo preparando il tuo ordine presso {order.venue.name}.
        </p>
      </div>

      <div className="w-full rounded-lg border bg-background p-4 text-sm">
        <div className="flex items-center justify-between border-b py-2">
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            {order.kind === "DELIVERY" ? (
              <Truck className="h-3.5 w-3.5" />
            ) : (
              <ShoppingBag className="h-3.5 w-3.5" />
            )}
            {order.kind === "DELIVERY" ? "Consegna" : "Ritiro"}
          </span>
          <span className="font-mono text-xs">#{order.reference.slice(-8).toUpperCase()}</span>
        </div>
        <div className="flex items-center justify-between border-b py-2">
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> Quando
          </span>
          <span>{formatDateTime(order.scheduledAt)}</span>
        </div>
        <ul className="space-y-1 border-b py-2 text-left text-xs">
          {order.items.map((it) => (
            <li key={it.id} className="flex justify-between">
              <span>
                {it.quantity}× {it.name}
              </span>
              <span>{formatCurrency(it.priceCents * it.quantity, order.currency)}</span>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between py-2">
          <span className="text-muted-foreground">Totale</span>
          <span className="text-display text-lg">{formatCurrency(order.totalCents, order.currency)}</span>
        </div>
      </div>

      <Button asChild variant="outline">
        <Link href={`/order/${params.slug}`}>Nuovo ordine</Link>
      </Button>
    </div>
  );
}
