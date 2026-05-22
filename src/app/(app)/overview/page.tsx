import Link from "next/link";
import {
  ArrowRight,
  CalendarPlus,
  Hourglass,
  LayoutPanelLeft,
  Phone,
  Plus,
  Search,
  TriangleAlert,
  Users,
  UserCheck,
  Zap,
  Tv,
} from "lucide-react";
import { db } from "@/lib/db";
import { getActiveVenue } from "@/lib/tenant";
import { getOverview } from "@/server/insights";
import { generateDailyBrief } from "@/lib/ai";
import { startOfDay, endOfDay, formatCurrency } from "@/lib/utils";
import type { TableLiveStatus } from "@/lib/floor";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { EmptyStateRich } from "@/components/ui/empty-state-rich";
import { LiveStrip, type LiveChip } from "@/components/overview/live-strip";
import { AIConciergePanel } from "@/components/overview/ai-concierge-panel";
import { ServiceTimeline, type TimelineRow } from "@/components/overview/service-timeline";
import { CustomerSpotlight, type SpotlightItem } from "@/components/overview/customer-spotlight";
import { FloorMiniMap } from "@/components/overview/floor-mini-map";
import { NextArrival, type ArrivalRow } from "@/components/overview/next-arrival";
import type { BookingStatusKey } from "@/components/ui/status-pill";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const ctx = await getActiveVenue();
  const room = await db.room.findFirst({ where: { venueId: ctx.venueId } });

  const [data, brief, tables, freeStats, waitlist, allTables] = await Promise.all([
    getOverview(ctx.venueId),
    generateDailyBrief(ctx.venueId),
    db.table.findMany({
      where: { venueId: ctx.venueId, active: true },
      select: { id: true, seats: true },
    }),
    db.booking.count({
      where: {
        venueId: ctx.venueId,
        startsAt: { gte: startOfDay(), lte: endOfDay() },
        status: { in: ["ARRIVED", "SEATED"] },
      },
    }),
    db.waitlistEntry.findMany({
      where: {
        venueId: ctx.venueId,
        status: { in: ["WAITING", "NOTIFIED", "OFFERED"] },
      },
      orderBy: { position: "asc" },
      take: 4,
      select: {
        id: true,
        guestName: true,
        partySize: true,
        expectedWaitMin: true,
        position: true,
        createdAt: true,
      },
    }),
    db.table.findMany({
      where: { venueId: ctx.venueId },
      select: {
        id: true,
        label: true,
        shape: true,
        posX: true,
        posY: true,
        rotation: true,
      },
    }),
  ]);

  const now = new Date();
  const totalSeats = tables.reduce((acc, t) => acc + t.seats, 0);
  const tableCount = tables.length;

  // Live status per table
  const activeBookings = data.todayBookings.filter((b) =>
    ["CONFIRMED", "PENDING", "ARRIVED", "SEATED"].includes(b.status),
  );
  const bookingByTable = new Map<string, (typeof activeBookings)[number]>();
  for (const b of activeBookings) {
    if (!b.tableId) continue;
    const priority: Record<string, number> = {
      SEATED: 4,
      ARRIVED: 3,
      CONFIRMED: 2,
      PENDING: 1,
    };
    const existing = bookingByTable.get(b.tableId);
    if (!existing || priority[b.status] > priority[existing.status]) {
      bookingByTable.set(b.tableId, b);
    }
  }

  const miniTables = allTables.map((t) => {
    const b = bookingByTable.get(t.id);
    let status: TableLiveStatus = "free";
    if (b) {
      if (b.status === "SEATED") status = "seated";
      else if (b.status === "ARRIVED") status = "arrived";
      else status = "reserved";
    }
    return { ...t, status };
  });

  // Upcoming (prossimi 30min)
  const upcoming30 = data.todayBookings.filter((b) => {
    const min = (new Date(b.startsAt).getTime() - now.getTime()) / 60_000;
    return min >= -5 && min <= 30 && (b.status === "CONFIRMED" || b.status === "PENDING");
  });

  const seatsOnsite = data.todayBookings
    .filter((b) => b.status === "ARRIVED" || b.status === "SEATED")
    .reduce((s, b) => s + b.partySize, 0);
  const tablesFreeNow = Math.max(0, tableCount - freeStats);
  const occupancyPct = totalSeats > 0 ? Math.round((seatsOnsite / totalSeats) * 100) : 0;

  // VIP attesi + compleanni
  const vips = data.todayBookings.filter(
    (b) => b.guest && (b.guest.loyaltyTier === "VIP" || b.guest.loyaltyTier === "AMBASSADOR"),
  );
  const birthdays = data.todayBookings.filter((b) => b.occasion === "BIRTHDAY");
  const allergies = data.todayBookings.filter((b) => b.guest?.allergies);

  // No-show risk: guest con noShowCount >= 2 e totalVisits <= 5
  const noShowRisk = data.todayBookings.filter((b) => {
    if (!b.guest) return false;
    const visits = b.guest.totalVisits ?? 0;
    return b.guest.noShowCount >= 2 && visits <= 5 && b.status === "CONFIRMED";
  });

  // Live strip chips
  const liveChips: LiveChip[] = [
    {
      key: "arrivals",
      label: "Arrivi (30min)",
      value: String(upcoming30.length),
      icon: UserCheck,
      href: "/bookings",
      tone: upcoming30.length > 0 ? "success" : "neutral",
      pulse: upcoming30.length > 0,
    },
    {
      key: "vip",
      label: "VIP oggi",
      value: String(vips.length),
      icon: Phone,
      href: "/guests?segment=vip",
      tone: vips.length > 0 ? "vip" : "neutral",
    },
    {
      key: "waitlist",
      label: "In lista",
      value: String(waitlist.length),
      icon: Hourglass,
      href: "/waitlist",
      tone: waitlist.length > 0 ? "warning" : "neutral",
      pulse: waitlist.length > 0,
    },
    {
      key: "noshow",
      label: "No-show risk",
      value: String(noShowRisk.length),
      icon: TriangleAlert,
      href: "/bookings",
      tone: noShowRisk.length > 0 ? "danger" : "neutral",
    },
    {
      key: "occupancy",
      label: "Occupazione",
      value: `${occupancyPct}%`,
      icon: LayoutPanelLeft,
      href: "/floor?mode=live",
      tone: occupancyPct >= 85 ? "danger" : occupancyPct >= 65 ? "warning" : "success",
    },
    {
      key: "covers",
      label: "Coperti attesi",
      value: String(data.totalCovers),
      icon: Users,
      href: "/bookings",
      tone: "gold",
    },
  ];

  // Timeline rows
  const timelineRows: TimelineRow[] = data.todayBookings.slice(0, 12).map((b) => ({
    id: b.id,
    startsAt: b.startsAt.toISOString(),
    durationMin: b.durationMin,
    partySize: b.partySize,
    status: b.status as BookingStatusKey,
    isVip:
      b.guest?.loyaltyTier === "VIP" || b.guest?.loyaltyTier === "AMBASSADOR",
    guestName: b.guest
      ? `${b.guest.firstName} ${b.guest.lastName ?? ""}`.trim()
      : "Walk-in",
    tableLabel: b.table?.label ?? null,
    notes: b.notes ?? null,
  }));

  // Customer spotlight
  const spotlight: SpotlightItem[] = [];
  for (const b of vips) {
    spotlight.push({
      bookingId: b.id,
      guestId: b.guestId,
      guestName: b.guest
        ? `${b.guest.firstName} ${b.guest.lastName ?? ""}`.trim()
        : "VIP",
      partySize: b.partySize,
      startsAt: b.startsAt.toISOString(),
      tableLabel: b.table?.label ?? null,
      reason: b.guest?.loyaltyTier === "AMBASSADOR" ? "ambassador" : "vip",
      detail: b.guest?.privateNotes ?? null,
    });
  }
  for (const b of birthdays) {
    if (spotlight.some((s) => s.bookingId === b.id)) continue;
    spotlight.push({
      bookingId: b.id,
      guestId: b.guestId,
      guestName: b.guest
        ? `${b.guest.firstName} ${b.guest.lastName ?? ""}`.trim()
        : "Compleanno",
      partySize: b.partySize,
      startsAt: b.startsAt.toISOString(),
      tableLabel: b.table?.label ?? null,
      reason: "birthday",
      detail: null,
    });
  }
  for (const b of allergies.slice(0, 2)) {
    if (spotlight.some((s) => s.bookingId === b.id)) continue;
    spotlight.push({
      bookingId: b.id,
      guestId: b.guestId,
      guestName: b.guest
        ? `${b.guest.firstName} ${b.guest.lastName ?? ""}`.trim()
        : "Allergie",
      partySize: b.partySize,
      startsAt: b.startsAt.toISOString(),
      tableLabel: b.table?.label ?? null,
      reason: "allergy",
      detail: b.guest?.allergies ?? null,
    });
  }

  // Next arrival
  const next = upcoming30.sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  )[0];
  const nextRow: ArrivalRow | null = next
    ? {
        id: next.id,
        startsAt: next.startsAt.toISOString(),
        partySize: next.partySize,
        guestName: next.guest
          ? `${next.guest.firstName} ${next.guest.lastName ?? ""}`.trim()
          : null,
        tableLabel: next.table?.label ?? null,
      }
    : null;

  const todayLabel = new Date().toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const firstName = ctx.session.user?.name?.split(" ")[0] ?? "ospite";

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header compatta ───────────────────────────────────────────── */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-tertiary">
            {ctx.venue.name} · <span className="capitalize">{todayLabel}</span>
          </p>
          <h1 className="text-display mt-1 text-[28px] font-medium leading-tight tracking-tight md:text-[32px]">
            Buongiorno, {firstName}.
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/bookings?walkin=1">
              <Zap className="h-3.5 w-3.5" /> Walk-in
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/guests">
              <Search className="h-3.5 w-3.5" /> Cerca ospite
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/now">
              <Tv className="h-3.5 w-3.5" /> Sala live
            </Link>
          </Button>
          <Button asChild variant="gold" size="sm">
            <Link href="/bookings/new">
              <CalendarPlus className="h-3.5 w-3.5" /> Nuova prenotazione
            </Link>
          </Button>
        </div>
      </header>

      {/* ── Live strip 6 chip ──────────────────────────────────────────── */}
      <LiveStrip chips={liveChips} />

      {/* ── Prossimo arrivo (always present) ───────────────────────────── */}
      <NextArrival next={nextRow} />

      {/* ── Main grid 60/40 ────────────────────────────────────────────── */}
      <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Panel className="flex flex-col">
          <PanelHeader
            title="Timeline servizio"
            description={`${data.todayBookings.length} prenotazioni · ${data.totalCovers} coperti attesi`}
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
            <ServiceTimeline rows={timelineRows} />
          </PanelBody>
        </Panel>

        <div className="space-y-4">
          <AIConciergePanel
            summary={brief.summary}
            suggestions={brief.suggestions}
            generatedBy={brief.generatedBy}
          />

          <Panel>
            <PanelHeader
              title={
                <span className="inline-flex items-center gap-2">
                  <Hourglass className="h-4 w-4 text-tertiary" /> Lista d&apos;attesa
                </span>
              }
              description={
                waitlist.length === 0
                  ? "Nessuno in coda"
                  : `${waitlist.length} ${waitlist.length === 1 ? "ospite" : "ospiti"} in coda`
              }
              action={
                <Link
                  href="/waitlist"
                  className="inline-flex items-center gap-1 text-xs font-medium text-secondary transition hover:text-foreground"
                >
                  Gestisci <ArrowRight className="h-3 w-3" />
                </Link>
              }
            />
            <PanelBody className="pt-0">
              {waitlist.length === 0 ? (
                <EmptyStateRich
                  size="compact"
                  title="Lista d'attesa vuota"
                  description="Aggiungi un ospite alla coda quando la sala è piena. Riceverà un SMS quando il tavolo è pronto."
                  primary={
                    <Button asChild variant="outline" size="sm">
                      <Link href="/waitlist">
                        <Plus className="h-3.5 w-3.5" /> Aggiungi
                      </Link>
                    </Button>
                  }
                />
              ) : (
                <ul className="divide-y divide-border">
                  {waitlist.map((w) => {
                    const minutesIn = Math.floor(
                      (now.getTime() - new Date(w.createdAt).getTime()) / 60_000,
                    );
                    const overdue = minutesIn > w.expectedWaitMin;
                    return (
                      <li
                        key={w.id}
                        className="flex items-center gap-3 py-2 text-sm"
                      >
                        <span className="grid h-7 w-7 place-items-center rounded-full bg-secondary text-numeric text-xs font-medium">
                          {w.position || "—"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{w.guestName}</p>
                          <p className="text-[11px] text-tertiary">
                            {w.partySize} pers · attesa {minutesIn}m
                            <span
                              className={
                                overdue
                                  ? " text-status-no-show font-medium"
                                  : " text-tertiary"
                              }
                            >
                              {" "}
                              / {w.expectedWaitMin}m
                            </span>
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </PanelBody>
          </Panel>

          <CustomerSpotlight items={spotlight} />
        </div>
      </section>

      {/* ── Bottom: floor map + alert + analytics ──────────────────────── */}
      <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <FloorMiniMap
          tables={miniTables}
          width={room?.width ?? 1200}
          height={room?.height ?? 760}
          scale={0.36}
        />

        <Panel>
          <PanelHeader
            title={
              <span className="inline-flex items-center gap-2">
                <TriangleAlert className="h-4 w-4 text-tertiary" /> Alert operativi
              </span>
            }
            description="Cose da risolvere"
          />
          <PanelBody className="pt-0">
            {data.alerts.length === 0 ? (
              <EmptyStateRich
                size="compact"
                title="Tutto sotto controllo"
                description="Nessuna criticità per il servizio. Continueremo a monitorare allergie, VIP attesi e prenotazioni senza tavolo."
              />
            ) : (
              <ul className="space-y-2">
                {data.alerts.slice(0, 5).map((a, i) => {
                  const tone =
                    a.kind === "danger"
                      ? "text-status-no-show bg-status-no-show-soft"
                      : a.kind === "info"
                        ? "text-gilt-dark bg-gilt/15"
                        : "text-status-pending bg-status-pending-soft";
                  return (
                    <li
                      key={i}
                      className="flex items-start gap-2.5 rounded-lg border border-border bg-card p-3"
                    >
                      <span
                        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${tone}`}
                      >
                        <TriangleAlert className="h-3 w-3" />
                      </span>
                      <p className="text-sm leading-snug">{a.message}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </PanelBody>
        </Panel>
      </section>

      {/* ── Footer mini metriche ──────────────────────────────────────── */}
      <Link
        href="/insights"
        className="group flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-5 py-4 transition-colors hover:border-border-strong"
      >
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <MiniMetric label="Coperti attesi" value={String(data.totalCovers)} />
          <MiniMetric
            label="Ricavi stimati"
            value={formatCurrency(data.estimatedRevenueCents, ctx.venue.currency)}
          />
          <MiniMetric label="No-show stimati" value={String(data.expectedNoShow)} />
          <MiniMetric label="Tavoli liberi" value={`${tablesFreeNow}/${tableCount}`} />
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-secondary transition group-hover:text-foreground">
          Apri analytics complete <ArrowRight className="h-3 w-3" />
        </span>
      </Link>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-tertiary">
        {label}
      </p>
      <p className="mt-0.5 text-display text-numeric text-lg font-medium leading-none">
        {value}
      </p>
    </div>
  );
}
