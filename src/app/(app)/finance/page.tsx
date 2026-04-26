import { getActiveVenue, can } from "@/lib/tenant";
import {
  financeOverview,
  listCosts,
  listShifts,
  listMenuItemCosts,
} from "@/server/finance";
import { db } from "@/lib/db";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatCard } from "@/components/overview/stat-card";
import { CostDialog } from "@/components/finance/cost-dialog";
import { ShiftDialog } from "@/components/finance/shift-dialog";
import { MenuCostInput } from "@/components/finance/menu-cost-input";
import { ExportButton } from "@/components/ui/export-button";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const CATEGORY_LABEL: Record<string, string> = {
  FOOD: "Food cost",
  BEVERAGE: "Bevande",
  STAFF: "Personale",
  RENT: "Affitto",
  UTILITIES: "Utenze",
  MARKETING: "Marketing",
  SUPPLIES: "Forniture",
  OTHER: "Altro",
};

export default async function FinancePage() {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "view_revenue")) {
    return (
      <div className="rounded-md border p-8 text-sm text-muted-foreground">
        Solo manager e marketing possono accedere al controllo economico.
      </div>
    );
  }
  const [overview, costs, shifts, menuCosts, menuItems] = await Promise.all([
    financeOverview(ctx.venueId, 30),
    listCosts(ctx.venueId, 30),
    listShifts(ctx.venueId, 30),
    listMenuItemCosts(ctx.venueId),
    db.menuItem.findMany({
      where: { venueId: ctx.venueId, available: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, priceCents: true },
      take: 200,
    }),
  ]);

  const costMap = new Map(menuCosts.map((c) => [c.menuItemId, c.costCents]));

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Operations</p>
          <h1 className="text-display text-3xl">Controllo economico</h1>
          <p className="text-sm text-muted-foreground">
            Margine 30 giorni con costi diretti, costo del personale e food cost stimato.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton kind="costs" label="Costi CSV" />
          <ExportButton kind="shifts" label="Turni CSV" />
          <ShiftDialog currency={ctx.venue.currency} />
          <CostDialog currency={ctx.venue.currency} />
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        <StatCard
          label="Ricavi 30gg"
          value={formatCurrency(overview.totalRevenueCents, ctx.venue.currency)}
          emphasize
        />
        <StatCard
          label="Costi diretti"
          value={formatCurrency(overview.totalCostsCents, ctx.venue.currency)}
        />
        <StatCard
          label="Costo personale"
          value={formatCurrency(overview.totalLaborCents, ctx.venue.currency)}
        />
        <StatCard
          label="Margine lordo"
          value={`${formatCurrency(overview.grossMarginCents, ctx.venue.currency)} · ${overview.marginRate}%`}
        />
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <StatCard label="Food cost %" value={`${overview.foodCostRate}%`} />
        <StatCard label="Costo lavoro %" value={`${overview.laborCostRate}%`} />
        <StatCard
          label="Ricavi medi/scontrino"
          value={formatCurrency(
            overview.totalRevenueCents > 0 ? Math.round(overview.totalRevenueCents / Math.max(1, costs.length || 1)) : 0,
            ctx.venue.currency,
          )}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Costi recenti</CardTitle>
            <CardDescription>Voci di spesa registrate negli ultimi 30 giorni.</CardDescription>
          </CardHeader>
          <CardContent>
            {costs.length === 0 ? (
              <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                Nessun costo registrato.
              </p>
            ) : (
              <ul className="divide-y text-sm">
                {costs.map((c) => (
                  <li key={c.id} className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium">{c.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {CATEGORY_LABEL[c.category] ?? c.category} · {formatDate(c.occurredOn)}
                        {c.recurring ? " · ricorrente" : ""}
                      </p>
                    </div>
                    <span className="text-display text-base">
                      {formatCurrency(c.amountCents, c.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Turni e personale</CardTitle>
            <CardDescription>
              Ore × tariffa oraria → costo del lavoro stimato per il margine.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {shifts.length === 0 ? (
              <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                Nessun turno registrato.
              </p>
            ) : (
              <ul className="divide-y text-sm">
                {shifts.map((s) => {
                  const cost = Math.round(s.hours * s.hourlyCents);
                  return (
                    <li key={s.id} className="flex items-center justify-between py-2">
                      <div>
                        <p className="font-medium">
                          {s.staffName}
                          {s.role ? <span className="ml-1 text-xs text-muted-foreground">· {s.role}</span> : null}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(s.date)} · {s.hours}h ×{" "}
                          {formatCurrency(s.hourlyCents, ctx.venue.currency)}
                        </p>
                      </div>
                      <span className="text-display text-base">
                        {formatCurrency(cost, ctx.venue.currency)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Food cost per piatto</CardTitle>
          <CardDescription>
            Imposta il costo materia prima per piatto: ti restituiamo margine e ricarico in
            tempo reale.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {menuItems.length === 0 ? (
            <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              Aggiungi voci al menu per impostare il food cost.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3">Piatto</th>
                    <th className="py-2 pr-3 text-right">Prezzo</th>
                    <th className="py-2 pr-3 text-right">Costo</th>
                    <th className="py-2 pr-3 text-right">Margine</th>
                    <th className="py-2 text-right">Food cost %</th>
                  </tr>
                </thead>
                <tbody>
                  {menuItems.map((it) => {
                    const costCents = costMap.get(it.id) ?? 0;
                    const margin = it.priceCents - costCents;
                    const fcPct =
                      it.priceCents > 0 ? Math.round((costCents / it.priceCents) * 100) : 0;
                    return (
                      <tr key={it.id} className="border-t">
                        <td className="py-2 pr-3 font-medium">{it.name}</td>
                        <td className="py-2 pr-3 text-right">
                          {formatCurrency(it.priceCents, ctx.venue.currency)}
                        </td>
                        <td className="py-2 pr-3 text-right">
                          <MenuCostInput menuItemId={it.id} initial={costCents} />
                        </td>
                        <td className="py-2 pr-3 text-right">
                          {formatCurrency(margin, ctx.venue.currency)}
                        </td>
                        <td className="py-2 text-right">{fcPct}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
