import Link from "next/link";
import {
  ArrowRight,
  CalendarPlus,
  Hourglass,
  PhoneCall,
  Plus,
  Search,
  Tv,
  TriangleAlert,
  Zap,
} from "lucide-react";
import { db } from "@/lib/db";
import { getActiveVenue } from "@/lib/tenant";
import { getOverview } from "@/server/insights";
import { generateDailyBrief } from "@/lib/ai";
import { startOfDay, endOfDay, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyStateRich } from "@/components/ui/empty-state-rich";
import { AIConciergePanel } from "@/components/overview/ai-concierge-panel";
import { ServiceTimeline, type TimelineRow } from "@/components/overview/service-timeline";
import type { BookingStatusKey } from "@/components/ui/status-pill";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const ctx = await getActiveVenue();

  const [data, brief, tables, freeStats, waitlist] = await Promise.all([
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
      take: 5,
      select: {
        id: true,
        guestName: true,
        partySize: true,
        expectedWaitMin: true,
        position: true,
        createdAt: true,
      },
    }),
  ]);

  const now = new Date();
  const totalSeats = tables.reduce((acc, t) => acc + t.seats, 0);
  const tableCount = tables.length;

  const seatsOnsite = data.todayBookings
    .filter((b) => b.status === "ARRIVED" || b.status === "SEATED")
    .reduce((s, b) => s + b.partySize, 0);
  const tablesFreeNow = Math.max(0, tableCount - freeStats);
  const occupancyPct = totalSeats > 0 ? Math.round((seatsOnsite / totalSeats) * 100) : 0;

  const noShowRisk = data.todayBookings.filter((b) => {
    if (!b.guest) return false;
    return (
      b.guest.noShowCount >= 2 &&
      (b.guest.totalVisits ?? 0) <= 5 &&
      b.status === "CONFIRMED"
    );
  });

  // Attesa media (in minuti)
  const avgWaitMin =
    waitlist.length > 0
      ? Math.round(
          waitlist.reduce(
            (s, w) =>
              s + (now.getTime() - new Date(w.createdAt).getTime()) / 60_000,
            0,
          ) / waitlist.length,
        )
      : 0;

  // Timeline rows (limito a 14 per non sovraccaricare)
  const timelineRows: TimelineRow[] = data.todayBookings.slice(0, 14).map((b) => ({
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

  const todayLabel = new Date().toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const firstName = ctx.session.user?.name?.split(" ")[0] ?? "ospite";

  // KPI tones
  const occTone =
    occupancyPct >= 85
      ? "danger"
      : occupancyPct >= 65
        ? "warning"
        : occupancyPct >= 30
          ? "success"
          : "neutral";

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-tertiary">
            {ctx.venue.name} · <span className="capitalize">{todayLabel}</span>
          </p>
          <h1 className="text-display mt-1 text-[34px] font-medium leading-tight tracking-tight md:text-[40px]">
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
          <Button asChild variant="gold" size="default">
            <Link href="/bookings/new">
              <CalendarPlus className="h-4 w-4" /> Nuova prenotazione
            </Link>
          </Button>
        </div>
      </header>

      {/* ── BIG KPI strip (5 grossi) ──────────────────────────────────── */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <BigKpi
          label="Coperti attesi"
          value={String(data.totalCovers)}
          hint={`${data.todayBookings.length} prenotazioni`}
          emphasized
        />
        <BigKpi
          label="Occupazione"
          value={`${occupancyPct}%`}
          hint={`${seatsOnsite}/${totalSeats} posti`}
          tone={occTone}
        />
        <BigKpi
          label="No-show risk"
          value={String(noShowRisk.length)}
          hint={
            noShowRisk.length === 0 ? "nessun rischio" : "ospiti monitorati"
          }
          tone={noShowRisk.length > 0 ? "danger" : "neutral"}
        />
        <BigKpi
          label="Attesa media"
          value={waitlist.length === 0 ? "—" : `${avgWaitMin}m`}
          hint={waitlist.length === 0 ? "lista vuota" : `${waitlist.length} in coda`}
          tone={avgWaitMin > 25 ? "warning" : "neutral"}
        />
        <BigKpi
          label="Ricavi stimati"
          value={formatCurrency(data.estimatedRevenueCents, ctx.venue.currency)}
          hint="spesa media × coperti"
        />
      </section>

      {/* ── MAIN: Timeline DOMINANTE (left) · Concierge + Waitlist (right) ── */}
      <section className="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
        {/* TIMELINE — DARK, hero section */}
        <section className="flex flex-col rounded-2xl border border-white/8 bg-carbon-800 text-sand-50 shadow-elevated">
          <header className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 px-6 py-5">
            <div>
              <p className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-gilt-light">
                Servizio di oggi
              </p>
              <h2 className="text-display mt-1 text-2xl font-medium leading-none">
                Timeline live
              </h2>
              <p className="mt-1 text-sm text-sand-50/55">
                <span className="text-numeric text-sand-50">{data.todayBookings.length}</span>{" "}
                prenotazioni ·{" "}
                <span className="text-numeric text-sand-50">{data.totalCovers}</span> coperti
                attesi
              </p>
            </div>
            <Link
              href="/bookings"
              className="inline-flex items-center gap-1.5 rounded-md border border-white/15 px-3 py-1.5 text-xs font-medium text-sand-50/85 transition-colors hover:bg-white/5"
            >
              Tutte <ArrowRight className="h-3 w-3" />
            </Link>
          </header>
          <div className="px-5 py-3">
            <ServiceTimeline rows={timelineRows} variant="dark" />
          </div>
        </section>

        {/* RIGHT COLUMN */}
        <div className="flex flex-col gap-4">
          {/* AI CONCIERGE — DARK */}
          <AIConciergePanel
            summary={brief.summary}
            suggestions={brief.suggestions}
            generatedBy={brief.generatedBy}
            variant="dark"
          />

          {/* WAITLIST — light card, BIG timers */}
          <section className="rounded-2xl border border-border bg-card">
            <header className="flex items-end justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <p className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-tertiary">
                  Lista d&apos;attesa
                </p>
                <h2 className="text-display mt-0.5 text-xl font-medium leading-none">
                  {waitlist.length === 0 ? "Vuota" : `${waitlist.length} in coda`}
                </h2>
              </div>
              <Link
                href="/waitlist"
                className="inline-flex items-center gap-1 text-xs font-medium text-secondary transition hover:text-foreground"
              >
                Gestisci <ArrowRight className="h-3 w-3" />
              </Link>
            </header>
            <div className="px-3 py-3">
              {waitlist.length === 0 ? (
                <EmptyStateRich
                  size="compact"
                  icon={Hourglass}
                  title="Coda vuota"
                  description="Aggiungi un walk-in quando la sala è piena. Riceverà un SMS quando il tavolo è pronto."
                  primary={
                    <Button asChild variant="outline" size="sm">
                      <Link href="/waitlist">
                        <Plus className="h-3.5 w-3.5" /> Aggiungi
                      </Link>
                    </Button>
                  }
                />
              ) : (
                <ul className="space-y-2">
                  {waitlist.map((w) => {
                    const minutesIn = Math.floor(
                      (now.getTime() - new Date(w.createdAt).getTime()) / 60_000,
                    );
                    const overdue = minutesIn > w.expectedWaitMin;
                    const progress = Math.min(
                      100,
                      (minutesIn / Math.max(1, w.expectedWaitMin)) * 100,
                    );
                    return (
                      <li
                        key={w.id}
                        className={cn(
                          "rounded-xl border px-3.5 py-3 transition-colors",
                          overdue
                            ? "border-status-no-show/30 bg-status-no-show-soft/40"
                            : "border-border bg-[hsl(var(--surface-sunken))]/40",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <span
                              className={cn(
                                "grid h-9 w-9 shrink-0 place-items-center rounded-full text-display text-numeric text-sm font-medium",
                                overdue
                                  ? "bg-status-no-show text-white"
                                  : "bg-foreground text-background",
                              )}
                            >
                              {w.position || "—"}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">
                                {w.guestName}
                              </p>
                              <p className="text-[11px] text-tertiary">
                                {w.partySize} pers
                              </p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p
                              className={cn(
                                "text-display text-numeric text-2xl font-medium leading-none tabular-nums",
                                overdue ? "text-status-no-show" : "text-foreground",
                              )}
                            >
                              {minutesIn}m
                            </p>
                            <p className="mt-0.5 text-[10.5px] text-tertiary text-numeric">
                              su {w.expectedWaitMin}m
                            </p>
                          </div>
                        </div>
                        {/* Progress bar */}
                        <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-secondary">
                          <div
                            className={cn(
                              "h-full transition-all duration-700",
                              overdue
                                ? "bg-status-no-show"
                                : progress >= 75
                                  ? "bg-status-pending"
                                  : "bg-status-confirmed",
                            )}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        </div>
      </section>

      {/* ── BOTTOM: Alert operativi + link analytics ──────────────────── */}
      <section className="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
        {/* Alert */}
        <section className="rounded-2xl border border-border bg-card">
          <header className="flex items-end justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <p className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-tertiary">
                Alert operativi
              </p>
              <h2 className="text-display mt-0.5 text-xl font-medium leading-none">
                {data.alerts.length === 0 ? "Tutto sotto controllo" : `${data.alerts.length} segnalazioni`}
              </h2>
            </div>
          </header>
          <div className="px-5 py-4">
            {data.alerts.length === 0 ? (
              <p className="text-sm text-secondary">
                Nessuna criticità per il servizio. Stiamo monitorando allergie, VIP attesi e prenotazioni senza tavolo.
              </p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {data.alerts.slice(0, 6).map((a, i) => {
                  const tone =
                    a.kind === "danger"
                      ? "text-status-no-show bg-status-no-show-soft"
                      : a.kind === "info"
                        ? "text-gilt-dark bg-gilt/15"
                        : "text-status-pending bg-status-pending-soft";
                  return (
                    <li
                      key={i}
                      className="flex items-start gap-2.5 rounded-xl border border-border bg-[hsl(var(--surface-sunken))]/40 p-3"
                    >
                      <span
                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${tone}`}
                      >
                        <TriangleAlert className="h-3.5 w-3.5" />
                      </span>
                      <p className="text-sm leading-snug">{a.message}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* Analytics link card */}
        <Link
          href="/insights"
          className="group flex flex-col justify-between gap-4 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-border-strong"
        >
          <div>
            <p className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-tertiary">
              Analytics
            </p>
            <h2 className="text-display mt-0.5 text-xl font-medium leading-none">
              Apri cockpit completo
            </h2>
            <p className="mt-2 text-sm text-secondary">
              Revenue, occupazione, no-show, fonti, performance staff e trend ultimi 90 giorni.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-secondary transition-colors group-hover:text-foreground">
            Vai a /insights <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </Link>
      </section>
    </div>
  );
}

function BigKpi({
  label,
  value,
  hint,
  emphasized,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  emphasized?: boolean;
  tone?: "success" | "warning" | "danger" | "neutral";
}) {
  const toneCls =
    tone === "success"
      ? "text-status-confirmed"
      : tone === "warning"
        ? "text-status-pending"
        : tone === "danger"
          ? "text-status-no-show"
          : "";

  return (
    <div
      className={cn(
        "rounded-2xl border px-5 py-5 transition-colors",
        emphasized
          ? "border-white/8 bg-carbon-800 text-sand-50"
          : "border-border bg-card",
      )}
    >
      <p
        className={cn(
          "text-[10.5px] font-medium uppercase tracking-[0.18em]",
          emphasized ? "text-gilt-light" : "text-tertiary",
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "text-display text-numeric mt-2 text-[42px] font-medium leading-none tabular-nums",
          emphasized ? "text-sand-50" : toneCls || "text-foreground",
        )}
      >
        {value}
      </p>
      {hint && (
        <p
          className={cn(
            "mt-2 text-[11.5px]",
            emphasized ? "text-sand-50/55" : "text-tertiary",
          )}
        >
          {hint}
        </p>
      )}
    </div>
  );
}
