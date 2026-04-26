import { Users } from "lucide-react";
import { getActiveVenue, can } from "@/lib/tenant";
import { staffPerformance, staffSummary } from "@/server/staff-performance";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatCard } from "@/components/overview/stat-card";

export const dynamic = "force-dynamic";

export default async function StaffPerformancePage() {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "manage_venue")) {
    return (
      <div className="rounded-md border p-8 text-sm text-muted-foreground">
        Non hai i permessi per vedere le metriche di team.
      </div>
    );
  }
  const [rows, summary] = await Promise.all([
    staffPerformance(ctx.venueId, 30),
    staffSummary(ctx.venueId, 30),
  ]);

  return (
    <div className="space-y-6 animate-fade-in">
      <header>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Operations</p>
        <h1 className="text-display text-3xl">Staff performance</h1>
        <p className="text-sm text-muted-foreground">
          Attività registrate sui tavoli e prenotazioni gestite negli ultimi 30 giorni.
        </p>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        <StatCard label="Eventi tracciati" value={String(summary.totalEvents)} emphasize />
        <StatCard label="Prenotazioni create" value={String(summary.totalCreated)} />
        <StatCard label="Tavoli completati" value={String(summary.totalCompleted)} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Classifica team</CardTitle>
          <CardDescription>
            Ordinato per azioni totali. Le metriche vengono aggregate dagli eventi reali sulle
            prenotazioni — nessuna telemetria invasiva.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
              Nessun membro del team registrato.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3">Membro</th>
                    <th className="py-2 pr-3 text-right">Prenotazioni</th>
                    <th className="py-2 pr-3 text-right">Cambi stato</th>
                    <th className="py-2 pr-3 text-right">No-show</th>
                    <th className="py-2 pr-3 text-right">Annulli</th>
                    <th className="py-2 text-right">Azioni totali</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.email} className="border-t">
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="grid h-7 w-7 place-items-center rounded-full bg-secondary text-xs">
                            <Users className="h-3.5 w-3.5" />
                          </span>
                          <div>
                            <p className="font-medium">{r.name}</p>
                            <p className="text-xs text-muted-foreground">{r.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 pr-3 text-right">{r.bookingsCreated}</td>
                      <td className="py-2 pr-3 text-right">{r.statusUpdates}</td>
                      <td className="py-2 pr-3 text-right">{r.noShows}</td>
                      <td className="py-2 pr-3 text-right">{r.cancellations}</td>
                      <td className="py-2 text-right text-display text-base">{r.totalActions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
