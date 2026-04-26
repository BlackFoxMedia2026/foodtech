import { notFound } from "next/navigation";
import { Utensils } from "lucide-react";
import { getTableMenu } from "@/server/table-orders";
import { getVenueBrandBySlug } from "@/server/branding";
import { TableOrderForm } from "@/components/table-orders/table-order-form";
import { PublicFootnote, PublicHeader } from "@/components/branding/public-shell";

export const dynamic = "force-dynamic";

export default async function TableOrderPage({
  params,
}: {
  params: { slug: string; label: string };
}) {
  const data = await getTableMenu(params.slug, params.label);
  if (!data) notFound();
  const { venue, table, categories } = data;
  const brand = await getVenueBrandBySlug(venue.slug);

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col gap-4 px-4 py-6">
      {brand ? (
        <PublicHeader brand={brand} kicker={`Tavolo ${table.label}`} />
      ) : (
        <header className="space-y-1">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Ordina al tavolo
          </p>
          <h1 className="flex items-center gap-2 text-display text-2xl">
            <Utensils className="h-6 w-6 text-gilt-dark" /> {venue.name}
          </h1>
        </header>
      )}
      <p className="text-sm text-muted-foreground">
        Tavolo <strong>{table.label}</strong> · pagamento al tavolo a fine servizio.
      </p>

      <TableOrderForm
        venueSlug={venue.slug}
        tableLabel={table.label}
        currency={venue.currency}
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          items: c.items.map((it) => ({
            id: it.id,
            name: it.name,
            description: it.description,
            priceCents: it.priceCents,
            currency: it.currency,
            dietary: it.dietary,
            allergens: it.allergens,
          })),
        }))}
      />

      {brand ? (
        <PublicFootnote brand={brand} />
      ) : (
        <footer className="mt-auto pt-6 text-[10px] text-muted-foreground">
          Powered by Tavolo · ordini istantanei in cucina, niente cerca-cameriere.
        </footer>
      )}
    </div>
  );
}
