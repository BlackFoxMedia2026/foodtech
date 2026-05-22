import { Users } from "lucide-react";
import { getActiveVenue, can } from "@/lib/tenant";
import { staffPerformance, staffSummary } from "@/server/staff-performance";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Stat } from "@/components/ui/stat";
import { EmptyStateRich } from "@/components/ui/empty-state-rich";
import { ExportButton } from "@/components/ui/export-button";

export const dynamic = "force-dynamic";

export default async function StaffPerformancePage() {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "manage_venue")) {
    return (
      <EmptyStateRich
        icon={Users}
        title="Accesso riservato al Manager"
        description="Solo i Manager possono vedere le metriche di team."
      />
    );
  }
  const [rows, summary] = await Promise.all([
    staffPerformance(ctx.venueId, 30),
    staffSummary(ctx.venueId, 30),
  ]);

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-tertiary">
            Analytics · Team
          </p>
          <h1 className="text-display mt-1 text-[34px] font-medium leading-tight tracking-tight">
            Staff performance
          </h1>
          <p className="mt-1 text-sm text-secondary">
            Attività registrate su tavoli e prenotazioni negli ultimi 30 giorni. Metriche aggregate dagli eventi reali — nessuna telemetria invasiva.
          </p>
        </div>
        <ExportButton kind="bookings" label="Prenotazioni CSV" />
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        <Stat label="Eventi tracciati" value={summary.totalEvents} hint="azioni totali team" emphasized />
        <Stat label="Prenotazioni create" value={summary.totalCreated} hint="nuovi inserimenti" />
        <Stat label="Tavoli completati" value={summary.totalCompleted} hint="servizi chiusi" />
      </section>

      <Panel>
        <PanelHeader
          title="Classifica team"
          description="Ordinata per azioni totali. Click sui membri non disponibile (privacy by design)."
        />
        <PanelBody className="pt-0">
          {rows.length === 0 ? (
            <EmptyStateRich
              icon={Users}
              title="Nessun membro del team"
              description="Aggiungi membri da Setup → Impostazioni → Team per iniziare a tracciare le performance."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-[hsl(var(--surface-sunken))]/60 text-[10.5px] font-medium uppercase tracking-[0.14em] text-tertiary">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Membro</th>
                    <th className="px-4 py-3 text-right font-medium">Prenotazioni</th>
                    <th className="px-4 py-3 text-right font-medium">Cambi stato</th>
                    <th className="px-4 py-3 text-right font-medium">No-show</th>
                    <th className="px-4 py-3 text-right font-medium">Annulli</th>
                    <th className="px-4 py-3 text-right font-medium">Azioni totali</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((r) => (
                    <tr key={r.email} className="transition-colors hover:bg-secondary/40">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-tertiary">
                            <Users className="h-4 w-4" />
                          </span>
                          <div>
                            <p className="font-medium">{r.name}</p>
                            <p className="text-xs text-tertiary">{r.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-numeric">{r.bookingsCreated}</td>
                      <td className="px-4 py-3 text-right text-numeric">{r.statusUpdates}</td>
                      <td className="px-4 py-3 text-right text-numeric text-status-no-show">
                        {r.noShows}
                      </td>
                      <td className="px-4 py-3 text-right text-numeric text-status-pending">
                        {r.cancellations}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-display text-numeric text-base font-medium">
                          {r.totalActions}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PanelBody>
      </Panel>
    </div>
  );
}
