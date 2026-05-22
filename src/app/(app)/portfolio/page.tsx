import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  Crown,
  Gauge,
  Users,
  BadgeAlert,
  Calendar,
} from "lucide-react";
import { getActiveVenue } from "@/lib/tenant";
import { getPortfolio } from "@/server/portfolio";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Stat } from "@/components/ui/stat";
import { PortfolioTrend } from "@/components/portfolio/portfolio-trend";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const ctx = await getActiveVenue();
  const data = await getPortfolio(ctx.orgId);

  return (
    <div className="space-y-6 animate-fade-in">
      <header>
        <p className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-tertiary">
          Analytics · Multi-locale
        </p>
        <h1 className="text-display mt-1 text-[34px] font-medium leading-tight tracking-tight">
          Portfolio · {ctx.org.name}
        </h1>
        <p className="mt-1 text-sm text-secondary">
          Vista aggregata su{" "}
          <span className="text-numeric text-foreground">{data.venues.length}</span>{" "}
          loca{data.venues.length === 1 ? "le" : "li"} attivi.
        </p>
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        <Stat label="Coperti oggi" value={data.aggregate.todayCovers} hint="totali nei locali" emphasized />
        <Stat label="Prenotazioni oggi" value={data.aggregate.todayBookings} hint="cross-locale" />
        <Stat label="Capienza totale" value={`${data.aggregate.totalCapacity}`} hint="posti disponibili" />
        <Stat label="Ospiti CRM" value={data.aggregate.totalGuests} hint="profili tracciati" />
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <Stat label="Coperti 7gg" value={data.aggregate.weekCovers} hint="ultima settimana" />
        <Stat
          label="Occupazione media"
          value={`${data.aggregate.avgUtilization}%`}
          hint="oggi cross-locale"
        />
        <Stat
          label="No-show medio"
          value={`${data.aggregate.avgNoShow}%`}
          hint={
            data.aggregate.avgNoShow >= 12
              ? "alto - controlla"
              : "in linea"
          }
        />
      </section>

      <Panel>
        <PanelHeader
          title="Andamento aggregato 7 giorni"
          description="Coperti totali su tutti i locali"
        />
        <PanelBody>
          <PortfolioTrend data={data.trend ?? []} />
        </PanelBody>
      </Panel>

      <section className="grid gap-4 lg:grid-cols-2">
        {data.venues.map((v) => (
          <Panel key={v.venueId}>
            <PanelHeader
              title={
                <span className="inline-flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-tertiary" /> {v.venueName}
                </span>
              }
              description={v.city ?? "—"}
              action={
                <Link
                  href="/overview"
                  className="inline-flex items-center gap-1 text-xs font-medium text-secondary transition hover:text-foreground"
                >
                  Dashboard <ArrowUpRight className="h-3 w-3" />
                </Link>
              }
            />
            <PanelBody className="space-y-3 pt-0">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Metric icon={<Calendar className="h-3.5 w-3.5" />} label="Prenotazioni" value={String(v.todayBookings)} />
                <Metric icon={<Users className="h-3.5 w-3.5" />} label="Coperti" value={String(v.todayCovers)} />
                <Metric
                  icon={<Gauge className="h-3.5 w-3.5" />}
                  label="Occupazione"
                  value={`${v.utilizationToday}%`}
                  highlight={v.utilizationToday >= 70}
                />
                <Metric
                  icon={<BadgeAlert className="h-3.5 w-3.5" />}
                  label="No-show 7gg"
                  value={`${v.noShowRate}%`}
                  warning={v.noShowRate >= 12}
                />
                <Metric icon={<Crown className="h-3.5 w-3.5" />} label="VIP oggi" value={`${v.vipShareToday}%`} />
                <Metric icon={<Calendar className="h-3.5 w-3.5" />} label="Caparre attive" value={String(v.upcomingDeposits)} />
              </div>
              <div className="space-y-1.5">
                <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className={cn(
                      "h-full transition-all duration-700",
                      v.utilizationToday >= 85
                        ? "bg-status-no-show"
                        : v.utilizationToday >= 65
                          ? "bg-status-pending"
                          : "bg-gilt",
                    )}
                    style={{ width: `${Math.min(100, v.utilizationToday)}%` }}
                  />
                </div>
                <p className="text-[11px] text-tertiary">
                  Occupazione vs capienza ({v.capacityToday} posti)
                </p>
              </div>
            </PanelBody>
          </Panel>
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
  warning,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
  warning?: boolean;
}) {
  return (
    <div className="panel-sunken px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.14em] text-tertiary">
        {icon}
        {label}
      </div>
      <p
        className={cn(
          "mt-1 text-display text-numeric text-lg font-medium leading-none tabular-nums",
          highlight && "text-gilt-light",
          warning && "text-status-no-show",
        )}
      >
        {value}
      </p>
    </div>
  );
}
