import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { listMenu, listMenuKeys, ALLERGEN_LABEL, DIETARY_LABEL } from "@/server/menu";
import { OrderForm } from "@/components/order/order-form";

export const dynamic = "force-dynamic";

export default async function PublicOrderPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { menu?: string };
}) {
  const venue = await db.venue.findFirst({
    where: { slug: params.slug, active: true },
    select: { id: true, name: true, slug: true, currency: true, city: true, phone: true },
  });
  if (!venue) notFound();

  const allKeys = await listMenuKeys(venue.id);
  const activeKey = searchParams.menu ?? allKeys[0] ?? "main";
  const categories = await listMenu(venue.id, activeKey);

  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-carbon-800 text-sand-50 font-display text-xs">
            T
          </span>
          <span>Tavolo · ordina online</span>
        </div>
      </header>

      <section className="space-y-2">
        <h1 className="text-display text-3xl leading-tight md:text-4xl">{venue.name}</h1>
        <p className="text-sm text-muted-foreground">
          Ordina e ritira o ricevi a casa. Niente commissioni di terze parti.
        </p>
      </section>

      {allKeys.length > 1 && (
        <nav className="flex flex-wrap gap-2 border-b pb-3 text-sm">
          {allKeys.map((k) => (
            <a
              key={k}
              href={`/order/${venue.slug}?menu=${k}`}
              className={
                k === activeKey
                  ? "rounded-full bg-carbon-800 px-3 py-1 text-sand-50"
                  : "rounded-full px-3 py-1 text-muted-foreground hover:bg-secondary"
              }
            >
              {k}
            </a>
          ))}
        </nav>
      )}

      {categories.length === 0 ? (
        <p className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
          Menu non ancora pubblicato.
        </p>
      ) : (
        <OrderForm
          slug={venue.slug}
          venueName={venue.name}
          currency={venue.currency}
          categories={categories.map((c) => ({
            id: c.id,
            name: c.name,
            items: c.items.map((it) => ({
              id: it.id,
              name: it.name,
              description: it.description,
              priceCents: it.priceCents,
              allergens: it.allergens,
              dietary: it.dietary,
            })),
          }))}
          allergenLabels={ALLERGEN_LABEL}
          dietaryLabels={DIETARY_LABEL}
        />
      )}

      <footer className="mt-auto pt-8 text-xs text-muted-foreground">
        Powered by <span className="font-medium text-foreground">Tavolo</span>
      </footer>
    </div>
  );
}
