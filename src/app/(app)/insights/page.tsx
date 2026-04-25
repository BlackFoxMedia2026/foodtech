import Link from "next/link";
import { ArrowUpRight, MessageCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/overview/stat-card";
import { SlotChart, SourcesChart } from "@/components/insights/charts";
import { getActiveVenue } from "@/lib/tenant";
import { getAnalytics } from "@/server/analytics";
import { feedbackStats } from "@/server/surveys";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const ctx = await getActiveVenue();
  const [a, fb] = await Promise.all([
    getAnalytics(ctx.venueId),
    feedbackStats(ctx.venueId),
  ]);

  return (
    <div className="space-y-6 animate-fade-in">
      <header>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Performance · ultimi 90 giorni</p>
        <h1 className="text-display text-3xl">Analytics</h1>
      </header>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Tasso completamento" value={`${a.occupancyRate}%`} hint="Prenotazioni completate" emphasize />
        <StatCard label="No-show" value={`${a.noShowRate}%`} hint="Sul totale" />
        <StatCard label="Cancellazioni" value={`${a.cancelRate}%`} />
        <StatCard label="Spesa media" value={formatCurrency(a.avgSpendCents, ctx.venue.currency)} hint="Per visita" />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Coperti per fascia oraria</CardTitle>
            <CardDescription>Distribuzione del flusso giornaliero</CardDescription>
          </CardHeader>
          <CardContent><SlotChart data={a.slots} /></CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fonti di prenotazione</CardTitle>
            <CardDescription>Dove arrivano i tuoi ospiti</CardDescription>
          </CardHeader>
          <CardContent><SourcesChart data={a.sources} /></CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" /> Sondaggi post-visita
            </CardTitle>
            <CardDescription>{fb.total} risposte raccolte</CardDescription>
          </div>
          <Link
            href="/insights/feedback"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Apri dashboard <ArrowUpRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-3 text-sm">
          <Stat label="NPS" value={String(fb.nps)} highlight />
          <Stat label="Promotori" value={String(fb.promoter)} />
          <Stat label="Detrattori" value={String(fb.detractor)} />
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Nuovi ospiti</CardTitle>
            <CardDescription>Acquisizione negli ultimi 90 giorni</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-display text-4xl">{a.newGuests}</p>
            <p className="text-sm text-muted-foreground">profili creati nel periodo</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Ospiti ricorrenti</CardTitle>
            <CardDescription>Hanno visitato più di una volta</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-display text-4xl">{a.repeatGuests}</p>
            <p className="text-sm text-muted-foreground">ospiti fedeli</p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 text-display text-2xl ${highlight ? "text-gilt-dark" : ""}`}>{value}</p>
    </div>
  );
}
