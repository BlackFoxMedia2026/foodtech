import { PiggyBank } from "lucide-react";
import { getActiveVenue, can } from "@/lib/tenant";
import {
  financeOverview,
  listCosts,
  listShifts,
  listMenuItemCosts,
} from "@/server/finance";
import { db } from "@/lib/db";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Stat } from "@/components/ui/stat";
import { EmptyStateRich } from "@/components/ui/empty-state-rich";
import { CostDialog } from "@/components/finance/cost-dialog";
import { ShiftDialog } from "@/components/finance/shift-dialog";
import { MenuCostInput } from "@/components/finance/menu-cost-input";
import { ExportButton } from "@/components/ui/export-button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

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
      <EmptyStateRich
        icon={PiggyBank}
        title="Accesso riservato"
        description="Solo Manager e Marketing possono accedere al controllo economico."
      />
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
          <p className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-tertiary">
            Analytics · Controllo economico
          </p>
          <h1 className="text-display mt-1 text-[34px] font-medium leading-tight tracking-tight">
            Economico
          </h1>
          <p className="mt-1 text-sm text-secondary">
            Margine 30 giorni con costi diretti, personale e food cost stimato.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportButton kind="costs" label="Costi CSV" />
          <ExportButton kind="shifts" label="Turni CSV" />
          <ShiftDialog currency={ctx.venue.currency} />
          <CostDialog currency={ctx.venue.currency} />
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        <Stat
          label="Ricavi 30gg"
          value={formatCurrency(overview.totalRevenueCents, ctx.venue.currency)}
          hint="incassi tracciati"
          emphasized
        />
        <Stat
          label="Costi diretti"
          value={formatCurrency(overview.totalCostsCents, ctx.venue.currency)}
          hint="forniture + utenze + altro"
        />
        <Stat
          label="Costo personale"
          value={formatCurrency(overview.totalLaborCents, ctx.venue.currency)}
          hint="turni × tariffa"
        />
        <Stat
          label="Margine lordo"
          value={formatCurrency(overview.grossMarginCents, ctx.venue.currency)}
          hint={`${overview.marginRate}% del fatturato`}
          delta={
            overview.marginRate >= 20
              ? { value: "ok", tone: "positive" }
              : { value: "rivedi", tone: "negative" }
          }
        />
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <Stat
          label="Food cost"
          value={`${overview.foodCostRate}%`}
          hint={
            overview.foodCostRate < 32
              ? "sotto controllo"
              : overview.foodCostRate < 38
                ? "in linea"
                : "monitora menu"
          }
        />
        <Stat
          label="Costo lavoro"
          value={`${overview.laborCostRate}%`}
          hint={
            overview.laborCostRate < 28
              ? "buono"
              : overview.laborCostRate < 35
                ? "in linea"
                : "verifica turni"
          }
        />
        <Stat
          label="Ricavi medi"
          value={formatCurrency(
            overview.totalRevenueCents > 0
              ? Math.round(
                  overview.totalRevenueCents / Math.max(1, costs.length || 1),
                )
              : 0,
            ctx.venue.currency,
          )}
          hint="per scontrino tracciato"
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Costi recenti"
            description="Voci di spesa registrate negli ultimi 30 giorni."
          />
          <PanelBody className="pt-0">
            {costs.length === 0 ? (
              <EmptyStateRich
                size="compact"
                icon={PiggyBank}
                title="Nessun costo registrato"
                description="Aggiungi costi (forniture, utenze, affitto) per calcolare il margine reale."
              />
            ) : (
              <ul className="divide-y divide-border text-sm">
                {costs.map((c) => (
                  <li key={c.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="font-medium">{c.label}</p>
                      <p className="text-xs text-tertiary">
                        {CATEGORY_LABEL[c.category] ?? c.category} ·{" "}
                        {formatDate(c.occurredOn)}
                        {c.recurring && (
                          <span className="ml-1.5 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium">
                            ricorrente
                          </span>
                        )}
                      </p>
                    </div>
                    <span className="text-display text-numeric text-base font-medium">
                      {formatCurrency(c.amountCents, c.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            title="Turni e personale"
            description="Ore × tariffa oraria → costo del lavoro stimato."
          />
          <PanelBody className="pt-0">
            {shifts.length === 0 ? (
              <EmptyStateRich
                size="compact"
                icon={PiggyBank}
                title="Nessun turno registrato"
                description="Aggiungi turni per attribuire correttamente il costo del personale."
              />
            ) : (
              <ul className="divide-y divide-border text-sm">
                {shifts.map((s) => {
                  const cost = Math.round(s.hours * s.hourlyCents);
                  return (
                    <li
                      key={s.id}
                      className="flex items-center justify-between py-2.5"
                    >
                      <div>
                        <p className="font-medium">
                          {s.staffName}
                          {s.role && (
                            <span className="ml-1 text-xs text-tertiary">· {s.role}</span>
                          )}
                        </p>
                        <p className="text-xs text-tertiary">
                          {formatDate(s.date)} · {s.hours}h ×{" "}
                          {formatCurrency(s.hourlyCents, ctx.venue.currency)}
                        </p>
                      </div>
                      <span className="text-display text-numeric text-base font-medium">
                        {formatCurrency(cost, ctx.venue.currency)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </PanelBody>
        </Panel>
      </div>

      <Panel>
        <PanelHeader
          title="Food cost per piatto"
          description="Imposta il costo materia prima per piatto: ti restituiamo margine e ricarico in tempo reale."
        />
        <PanelBody className="pt-0">
          {menuItems.length === 0 ? (
            <EmptyStateRich
              icon={PiggyBank}
              title="Nessun piatto in menu"
              description="Aggiungi voci al menu digitale per impostare il food cost."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-[hsl(var(--surface-sunken))]/60 text-[10.5px] font-medium uppercase tracking-[0.14em] text-tertiary">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Piatto</th>
                    <th className="px-4 py-3 text-right font-medium">Prezzo</th>
                    <th className="px-4 py-3 text-right font-medium">Costo</th>
                    <th className="px-4 py-3 text-right font-medium">Margine</th>
                    <th className="px-4 py-3 text-right font-medium">Food cost %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {menuItems.map((it) => {
                    const costCents = costMap.get(it.id) ?? 0;
                    const margin = it.priceCents - costCents;
                    const fcPct =
                      it.priceCents > 0
                        ? Math.round((costCents / it.priceCents) * 100)
                        : 0;
                    const fcTone =
                      fcPct < 30
                        ? "text-status-confirmed"
                        : fcPct < 40
                          ? "text-status-pending"
                          : "text-status-no-show";
                    return (
                      <tr
                        key={it.id}
                        className="transition-colors hover:bg-secondary/40"
                      >
                        <td className="px-4 py-3 font-medium">{it.name}</td>
                        <td className="px-4 py-3 text-right text-numeric">
                          {formatCurrency(it.priceCents, ctx.venue.currency)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <MenuCostInput menuItemId={it.id} initial={costCents} />
                        </td>
                        <td className="px-4 py-3 text-right text-numeric">
                          {formatCurrency(margin, ctx.venue.currency)}
                        </td>
                        <td
                          className={cn(
                            "px-4 py-3 text-right text-display text-numeric text-base font-medium",
                            costCents > 0 && fcTone,
                          )}
                        >
                          {costCents > 0 ? `${fcPct}%` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </PanelBody>
      </Panel>
    </div>
  );
}
