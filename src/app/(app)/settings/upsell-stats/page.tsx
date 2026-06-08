import { redirect } from "next/navigation";
import { can, getActiveVenue } from "@/lib/tenant";
import { db } from "@/lib/db";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Stat } from "@/components/ui/stat";
import { loadUpsellStats } from "@/server/upsell-ranking";

export const dynamic = "force-dynamic";

const REASON_LABEL: Record<string, string> = {
  wine_pairing: "Abbinamento vino rosso",
  white_wine_pairing: "Abbinamento vino bianco",
  coffee_after: "Caffè dopo il dolce",
  antipasto: "Antipasto",
  dessert: "Dessert finale",
  dietary_complement: "Coerenza dietetica",
};

function parseDaysBack(raw: string | string[] | undefined): 7 | 30 | 60 {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === "7") return 7;
  if (v === "30") return 30;
  return 60;
}

function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

export default async function UpsellStatsPage({
  searchParams,
}: {
  searchParams: { days?: string };
}) {
  const ctx = await getActiveVenue();
  // Manager-only: aligns with the rest of `/settings/*` admin tooling.
  if (!can(ctx.role, "manage_venue")) redirect("/settings");

  const daysBack = parseDaysBack(searchParams.days);
  const stats = await loadUpsellStats(ctx.venueId, daysBack);

  // Hydrate menuItem names in a single query.
  const ids = Array.from(new Set(stats.map((s) => s.menuItemId)));
  const items = ids.length
    ? await db.menuItem.findMany({
        where: { id: { in: ids }, venueId: ctx.venueId },
        select: { id: true, name: true },
      })
    : [];
  const nameById = new Map(items.map((i) => [i.id, i.name]));

  const rows = stats
    .map((s) => ({
      ...s,
      reasonLabel: REASON_LABEL[s.reason] ?? s.reason,
      itemName: nameById.get(s.menuItemId) ?? "(item rimosso)",
    }))
    .sort((a, b) => b.smoothedCtr - a.smoothedCtr);

  const totalShows = rows.reduce((sum, r) => sum + r.showCount, 0);
  const totalClicks = rows.reduce((sum, r) => sum + r.clickCount, 0);
  const avgCtr = totalShows === 0 ? 0 : totalClicks / totalShows;
  const top = rows[0];

  return (
    <div className="space-y-6 animate-fade-in">
      <header>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Performance · pre-order
        </p>
        <h1 className="text-display text-3xl">Performance upsell concierge</h1>
        <p className="mt-1 text-sm text-secondary">
          Quanto convertono i suggerimenti automatici del pre-order. Ordinato per
          CTR smoothed (Laplace prior 20%) per evitare falsi vincitori da 1
          singolo click.
        </p>
      </header>

      <nav className="flex gap-2 text-sm">
        {[7, 30, 60].map((d) => (
          <a
            key={d}
            href={`?days=${d}`}
            className={
              d === daysBack
                ? "rounded-md bg-foreground/10 px-3 py-1 font-medium"
                : "rounded-md px-3 py-1 text-tertiary hover:bg-foreground/5"
            }
          >
            Ultimi {d}gg
          </a>
        ))}
      </nav>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Shows totali" value={totalShows} />
        <Stat label="Clicks totali" value={totalClicks} />
        <Stat label="CTR medio" value={pct(avgCtr)} />
        <Stat
          label="Top performer"
          value={top ? top.itemName : "—"}
          hint={top ? `${pct(top.smoothedCtr)} smoothed` : undefined}
        />
      </div>

      <Panel>
        <PanelHeader
          title="Dettaglio per suggerimento"
          description={`Coppie (reason, item) con almeno una show negli ultimi ${daysBack} giorni.`}
        />
        <PanelBody className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wider text-tertiary">
                <th className="py-2 pr-3 font-medium">Motivo</th>
                <th className="py-2 pr-3 font-medium">Item</th>
                <th className="py-2 pr-3 font-medium text-right">Shows</th>
                <th className="py-2 pr-3 font-medium text-right">Clicks</th>
                <th className="py-2 pr-3 font-medium text-right">CTR</th>
                <th className="py-2 pr-3 font-medium text-right">
                  smoothedCTR
                </th>
              </tr>
            </thead>
            <tbody className="text-numeric">
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="py-8 text-center text-sm text-tertiary"
                  >
                    Nessun evento registrato in questo periodo.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr
                  key={`${r.reason}::${r.menuItemId}`}
                  className="border-b border-border/40"
                >
                  <td className="py-2 pr-3">{r.reasonLabel}</td>
                  <td className="py-2 pr-3 text-secondary">{r.itemName}</td>
                  <td className="py-2 pr-3 text-right">{r.showCount}</td>
                  <td className="py-2 pr-3 text-right">{r.clickCount}</td>
                  <td className="py-2 pr-3 text-right text-tertiary">
                    {pct(r.ctr)}
                  </td>
                  <td className="py-2 pr-3 text-right font-medium">
                    {pct(r.smoothedCtr)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </PanelBody>
      </Panel>
    </div>
  );
}
