import Link from "next/link";
import { ArrowUpRight, Building2, Crown, Gauge, Users, BadgeAlert, Calendar } from "lucide-react";
import { getActiveVenue } from "@/lib/tenant";
import { getPortfolio } from "@/server/portfolio";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatCard } from "@/components/overview/stat-card";
import { PortfolioTrend } from "@/components/portfolio/portfolio-trend";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const ctx = await getActiveVenue();
  const data = await getPortfolio(ctx.orgId);

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Multi-locale</p>
          <h1 className="text-display text-3xl">Portfolio · {ctx.org.name}</h1>
          <p className="text-sm text-muted-foreground">
            Vista aggregata su {data.venues.length} loca{data.venues.length === 1 ? "le" : "li"} attivi.
          </p>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        <StatCard label="Coperti oggi" value={String(data.aggregate.todayCovers)} emphasize />
        <StatCard label="Prenotazioni oggi" value={String(data.aggregate.todayBookings)} />
        <StatCard label="Capienza totale" value={`${data.aggregate.totalCapacity} posti`} />
        <StatCard label="Ospiti CRM" value={String(data.aggregate.totalGuests)} />
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <StatCard label="Coperti 7gg" value={String(data.aggregate.weekCovers)} />
        <StatCard label="Occupazione media oggi" value={`${data.aggregate.avgUtilization}%`} />
        <StatCard label="No-show medio" value={`${data.aggregate.avgNoShow}%`} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Andamento aggregato 7 giorni</CardTitle>
          <CardDescription>Coperti totali su tutti i locali</CardDescription>
        </CardHeader>
        <CardContent>
          <PortfolioTrend data={data.trend ?? []} />
        </CardContent>
      </Card>

      <section className="grid gap-4 lg:grid-cols-2">
        {data.venues.map((v) => (
          <Card key={v.venueId}>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle className="inline-flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" /> {v.venueName}
                </CardTitle>
                <CardDescription>{v.city ?? "—"}</CardDescription>
              </div>
              <Link
                href="/overview"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Apri dashboard <ArrowUpRight className="h-3 w-3" />
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Metric icon={<Calendar className="h-3.5 w-3.5" />} label="Prenotazioni oggi" value={String(v.todayBookings)} />
                <Metric icon={<Users className="h-3.5 w-3.5" />} label="Coperti oggi" value={String(v.todayCovers)} />
                <Metric icon={<Gauge className="h-3.5 w-3.5" />} label="Occupazione" value={`${v.utilizationToday}%`} highlight={v.utilizationToday >= 70} />
                <Metric icon={<BadgeAlert className="h-3.5 w-3.5" />} label="No-show 7gg" value={`${v.noShowRate}%`} highlight={v.noShowRate >= 12} />
                <Metric icon={<Crown className="h-3.5 w-3.5" />} label="VIP oggi" value={`${v.vipShareToday}%`} />
                <Metric icon={<Calendar className="h-3.5 w-3.5" />} label="Caparre attive" value={String(v.upcomingDeposits)} />
              </div>
              <div className="space-y-1.5">
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full bg-gilt"
                    style={{ width: `${Math.min(100, v.utilizationToday)}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Occupazione vs capienza ({v.capacityToday} posti)
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className={`mt-1 text-lg ${highlight ? "text-gilt-dark font-semibold" : ""}`}>{value}</p>
    </div>
  );
}
