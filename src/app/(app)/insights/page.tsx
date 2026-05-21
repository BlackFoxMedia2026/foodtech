import Link from "next/link";
import { ArrowRight, MessageCircle, TrendingUp, UserPlus, Users } from "lucide-react";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Stat } from "@/components/ui/stat";
import { SlotChart, SourcesChart } from "@/components/insights/charts";
import { getActiveVenue } from "@/lib/tenant";
import { getAnalytics } from "@/server/analytics";
import { feedbackStats } from "@/server/surveys";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const ctx = await getActiveVenue();
  const [a, fb] = await Promise.all([
    getAnalytics(ctx.venueId),
    feedbackStats(ctx.venueId),
  ]);

  const npsTone =
    fb.nps >= 50 ? "text-status-confirmed" : fb.nps >= 0 ? "text-foreground" : "text-status-no-show";

  return (
    <div className="space-y-10 animate-fade-in">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-tertiary">
          Performance · ultimi 90 giorni
        </p>
        <h1 className="text-display mt-1 text-[32px] font-medium leading-tight tracking-tight">
          Analytics
        </h1>
        <p className="mt-1 text-sm text-secondary">
          Indicatori operativi del locale: completamento, no-show, fonti, ricavi.
        </p>
      </header>

      {/* Hero KPIs — 3 metriche che contano davvero */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Stat
          label="Tasso completamento"
          value={`${a.occupancyRate}%`}
          hint="prenotazioni concluse"
          icon={TrendingUp}
          emphasized
        />
        <Stat
          label="Spesa media"
          value={formatCurrency(a.avgSpendCents, ctx.venue.currency)}
          hint="per visita"
        />
        <Stat
          label="Net Promoter Score"
          value={String(fb.nps)}
          hint={`${fb.total} risposte`}
          delta={
            fb.nps >= 50
              ? { value: "ottimo", tone: "positive" }
              : fb.nps >= 0
                ? { value: "stabile", tone: "neutral" }
                : { value: "critico", tone: "negative" }
          }
        />
      </section>

      {/* Secondary metrics — riga compatta */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MicroKpi label="No-show" value={`${a.noShowRate}%`} tone={a.noShowRate > 10 ? "warning" : undefined} />
        <MicroKpi label="Cancellazioni" value={`${a.cancelRate}%`} />
        <MicroKpi label="Nuovi ospiti" value={String(a.newGuests)} icon={<UserPlus className="h-3.5 w-3.5 text-tertiary" />} />
        <MicroKpi label="Ricorrenti" value={String(a.repeatGuests)} icon={<Users className="h-3.5 w-3.5 text-tertiary" />} />
      </section>

      {/* Charts */}
      <section className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Coperti per fascia oraria"
            description="Distribuzione del flusso giornaliero"
          />
          <PanelBody>
            <SlotChart data={a.slots} />
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            title="Fonti di prenotazione"
            description="Da dove arrivano gli ospiti"
          />
          <PanelBody>
            <SourcesChart data={a.sources} />
          </PanelBody>
        </Panel>
      </section>

      {/* Feedback panel */}
      <Panel>
        <PanelHeader
          title={
            <span className="inline-flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-tertiary" /> Sondaggi post-visita
            </span>
          }
          description={`${fb.total} risposte raccolte negli ultimi 90 giorni`}
          action={
            <Link
              href="/insights/feedback"
              className="inline-flex items-center gap-1 text-xs font-medium text-secondary transition hover:text-foreground"
            >
              Dashboard completa <ArrowRight className="h-3 w-3" />
            </Link>
          }
        />
        <PanelBody className="grid grid-cols-3 gap-4">
          <FeedbackTile label="NPS" value={String(fb.nps)} valueClassName={npsTone} large />
          <FeedbackTile label="Promotori" value={String(fb.promoter)} />
          <FeedbackTile label="Detrattori" value={String(fb.detractor)} valueClassName={fb.detractor > 0 ? "text-status-no-show" : undefined} />
        </PanelBody>
      </Panel>
    </div>
  );
}

function MicroKpi({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string;
  tone?: "warning";
  icon?: React.ReactNode;
}) {
  return (
    <div className="panel-sunken px-4 py-3">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-tertiary">
        {icon} {label}
      </div>
      <p
        className={cn(
          "mt-1 text-display text-numeric text-xl font-medium leading-none",
          tone === "warning" && "text-status-pending",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function FeedbackTile({
  label,
  value,
  valueClassName,
  large,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  large?: boolean;
}) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-tertiary">{label}</p>
      <p
        className={cn(
          "mt-1 text-display text-numeric font-medium leading-none",
          large ? "text-4xl" : "text-2xl",
          valueClassName,
        )}
      >
        {value}
      </p>
    </div>
  );
}
