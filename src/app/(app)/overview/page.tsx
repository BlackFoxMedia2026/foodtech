import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarPlus, Info, Sparkles, TrendingUp, Users } from "lucide-react";
import { Stat } from "@/components/ui/stat";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { WeekTrend } from "@/components/overview/week-trend";
import { TodayTimeline } from "@/components/overview/today-timeline";
import { getActiveVenue } from "@/lib/tenant";
import { getOverview } from "@/server/insights";
import { generateDailyBrief } from "@/lib/ai";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const ctx = await getActiveVenue();
  const [data, brief] = await Promise.all([
    getOverview(ctx.venueId),
    generateDailyBrief(ctx.venueId),
  ]);

  const todayLabel = new Date().toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const firstName = ctx.session.user?.name?.split(" ")[0] ?? "ospite";
  const topSuggestion = brief.suggestions.find((s) => s.kind !== "SUMMARY");
  const occupancyPct = Math.min(100, Math.round((data.totalCovers / 90) * 100));

  return (
    <div className="space-y-10 animate-fade-in">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-tertiary">
            {ctx.venue.name} · <span className="capitalize">{todayLabel}</span>
          </p>
          <h1 className="text-display mt-1 text-[34px] font-medium leading-tight tracking-tight">
            Buongiorno, {firstName}.
          </h1>
          <p className="mt-1 text-sm text-secondary">
            Ecco cosa sta succedendo oggi al tuo locale.
          </p>
        </div>
        <Button asChild variant="gold" size="default">
          <Link href="/bookings/new">
            <CalendarPlus className="h-4 w-4" /> Nuova prenotazione
          </Link>
        </Button>
      </header>

      {topSuggestion && (
        <Link
          href={topSuggestion.actionHref ?? "#"}
          className="group flex items-start gap-4 rounded-xl border border-gilt/25 bg-gilt/[0.05] p-4 transition-colors hover:bg-gilt/[0.08]"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gilt/15 text-gilt-dark">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-gilt-dark">
              Brief operativo
            </p>
            <p className="mt-0.5 text-sm font-medium text-foreground">{brief.summary}</p>
            <p className="mt-1 text-sm text-secondary">{topSuggestion.title}</p>
          </div>
          {topSuggestion.actionLabel && (
            <span className="flex items-center gap-1 self-center text-xs font-medium text-gilt-dark opacity-0 transition-opacity group-hover:opacity-100">
              {topSuggestion.actionLabel} <ArrowRight className="h-3.5 w-3.5" />
            </span>
          )}
        </Link>
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Coperti previsti"
          value={data.totalCovers}
          hint={`${data.todayBookings.length} prenotazioni`}
          icon={Users}
          emphasized
        />
        <Stat
          label="Occupazione"
          value={`${occupancyPct}%`}
          hint="Turno cena · 90 coperti"
          icon={TrendingUp}
        />
        <Stat
          label="No-show stimati"
          value={data.expectedNoShow}
          hint="Storico ospiti"
          delta={
            data.expectedNoShow > 0
              ? { value: `${data.expectedNoShow}`, tone: "negative" }
              : undefined
          }
        />
        <Stat
          label="Incassi stimati"
          value={formatCurrency(data.estimatedRevenueCents, ctx.venue.currency)}
          hint="Spesa media × coperti"
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
        <Panel>
          <PanelHeader
            title="Prenotazioni di oggi"
            description="Aggiornate in tempo reale"
            action={
              <Link
                href="/bookings"
                className="inline-flex items-center gap-1 text-xs font-medium text-secondary transition hover:text-foreground"
              >
                Tutte <ArrowRight className="h-3 w-3" />
              </Link>
            }
          />
          <PanelBody className="pt-0">
            <TodayTimeline bookings={data.todayBookings} />
          </PanelBody>
        </Panel>

        <Panel className="flex flex-col">
          <PanelHeader title="Alert" description="Cose da tenere d'occhio" />
          <PanelBody className="pt-0">
            {data.alerts.length === 0 ? (
              <EmptyState
                icon={Sparkles}
                title="Tutto sotto controllo"
                description="Nessun alert per il servizio di oggi."
              />
            ) : (
              <ul className="space-y-2">
                {data.alerts.slice(0, 4).map((a, i) => (
                  <AlertRow key={i} kind={a.kind} message={a.message} />
                ))}
              </ul>
            )}
          </PanelBody>
        </Panel>
      </section>

      <Panel>
        <PanelHeader
          title="Andamento settimanale"
          description="Coperti e prenotazioni · ultimi 7 giorni"
        />
        <PanelBody>
          <WeekTrend data={data.trend} />
        </PanelBody>
      </Panel>
    </div>
  );
}

function AlertRow({ kind, message }: { kind: string; message: string }) {
  const Icon = kind === "danger" ? AlertTriangle : kind === "info" ? Sparkles : Info;
  const tone =
    kind === "danger"
      ? "text-status-no-show"
      : kind === "info"
        ? "text-gilt-dark"
        : "text-status-pending";
  return (
    <li className="flex items-start gap-2.5 rounded-lg border border-border bg-[hsl(var(--surface-sunken))]/40 p-3">
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", tone)} />
      <p className="text-sm text-foreground">{message}</p>
    </li>
  );
}
