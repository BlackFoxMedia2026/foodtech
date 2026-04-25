import { notFound } from "next/navigation";
import { MapPin, Phone } from "lucide-react";
import { db } from "@/lib/db";
import { listMenu, listMenuKeys, ALLERGEN_LABEL, DIETARY_LABEL } from "@/server/menu";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PublicMenuPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { menu?: string };
}) {
  const venue = await db.venue.findFirst({
    where: { slug: params.slug, active: true },
    select: {
      id: true,
      name: true,
      slug: true,
      city: true,
      address: true,
      phone: true,
      currency: true,
    },
  });
  if (!venue) notFound();
  const allKeys = await listMenuKeys(venue.id);
  const activeKey = searchParams.menu ?? allKeys[0] ?? "main";
  const categories = await listMenu(venue.id, activeKey);

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-carbon-800 text-sand-50 font-display text-xs">
            T
          </span>
          <span>Tavolo · menu</span>
        </div>
      </header>

      <section className="space-y-3">
        <h1 className="text-display text-4xl leading-tight md:text-5xl">{venue.name}</h1>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {venue.city && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> {[venue.address, venue.city].filter(Boolean).join(" · ")}
            </span>
          )}
          {venue.phone && (
            <span className="inline-flex items-center gap-1">
              <Phone className="h-3.5 w-3.5" /> {venue.phone}
            </span>
          )}
        </div>
      </section>

      {allKeys.length > 1 && (
        <nav className="flex flex-wrap gap-2 border-b pb-3 text-sm">
          {allKeys.map((k) => (
            <a
              key={k}
              href={`/m/${venue.slug}?menu=${k}`}
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
          Menu non ancora disponibile.
        </p>
      ) : (
        <div className="space-y-10">
          {categories.map((c) => (
            <section key={c.id} className="space-y-4">
              <h2 className="border-b pb-2 text-display text-2xl">{c.name}</h2>
              <ul className="divide-y">
                {c.items.length === 0 && (
                  <li className="py-3 text-sm text-muted-foreground">Sezione in aggiornamento.</li>
                )}
                {c.items.map((it) => (
                  <li key={it.id} className="py-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="text-base font-medium">{it.name}</h3>
                      <span className="shrink-0 text-base">{formatCurrency(it.priceCents, it.currency)}</span>
                    </div>
                    {it.description && (
                      <p className="mt-1 text-sm text-muted-foreground">{it.description}</p>
                    )}
                    {(it.dietary.length > 0 || it.allergens.length > 0) && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                        {it.dietary.map((d) => (
                          <span
                            key={d}
                            className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-emerald-800"
                          >
                            {DIETARY_LABEL[d as keyof typeof DIETARY_LABEL] ?? d}
                          </span>
                        ))}
                        {it.allergens.map((a) => (
                          <span
                            key={a}
                            className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-amber-800"
                          >
                            {ALLERGEN_LABEL[a as keyof typeof ALLERGEN_LABEL] ?? a}
                          </span>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <footer className="mt-auto pt-8 text-xs text-muted-foreground">
        Powered by <span className="font-medium text-foreground">Tavolo</span>
      </footer>
    </div>
  );
}
