import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { getActiveVenue } from "@/lib/tenant";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { listAdminMenu, listMenuKeys } from "@/server/menu";
import { MenuBuilder } from "@/components/menu/menu-builder";

export const dynamic = "force-dynamic";

export default async function MenuAdminPage({
  searchParams,
}: {
  searchParams: { menu?: string };
}) {
  const ctx = await getActiveVenue();
  const keys = await listMenuKeys(ctx.venueId);
  const allKeys = Array.from(new Set([...keys, "main"]));
  const active = searchParams.menu ?? allKeys[0] ?? "main";
  const categories = await listAdminMenu(ctx.venueId, active);

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-tertiary">
            Setup · Cucina
          </p>
          <h1 className="text-display mt-1 text-[34px] font-medium leading-tight tracking-tight">
            Menu digitale
          </h1>
          <p className="mt-1 text-sm text-secondary">
            Categorie e piatti con allergeni e diete. Pubblicazione in tempo reale via QR.
          </p>
        </div>
        <Link
          href={`/m/${ctx.venue.slug}?menu=${active}`}
          target="_blank"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-secondary transition-colors hover:border-border-strong hover:text-foreground"
        >
          Apri menu pubblico <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </header>

      <Panel>
        <PanelHeader
          title="Menu pubblicati"
          description="Puoi avere più menu separati (pranzo, cena, degustazione, eventi). Ogni menu ha la sua URL."
        />
        <PanelBody>
          <MenuBuilder
            initialCategories={categories.map((c) => ({
              id: c.id,
              name: c.name,
              menuKey: c.menuKey,
              ordering: c.ordering,
              active: c.active,
              items: c.items.map((it) => ({
                id: it.id,
                categoryId: it.categoryId,
                name: it.name,
                description: it.description,
                priceCents: it.priceCents,
                currency: it.currency,
                available: it.available,
                ordering: it.ordering,
                allergens: it.allergens,
                dietary: it.dietary,
                imageUrl: it.imageUrl,
              })),
            }))}
            menuKey={active}
            availableKeys={allKeys}
            currency={ctx.venue.currency}
            venueSlug={ctx.venue.slug}
          />
        </PanelBody>
      </Panel>
    </div>
  );
}
