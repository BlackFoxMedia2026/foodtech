import Link from "next/link";
import {
  ArrowRight,
  CalendarPlus,
  Cake,
  Crown,
  Hourglass,
  LayoutPanelLeft,
  PhoneCall,
  Plus,
  Search,
  Sparkles,
  TriangleAlert,
  Tv,
  Users,
  UserCheck,
  Zap,
} from "lucide-react";
import { db } from "@/lib/db";
import { getActiveVenue } from "@/lib/tenant";
import { getOverview } from "@/server/insights";
import { generateDailyBrief } from "@/lib/ai";
import { startOfDay, endOfDay, formatCurrency } from "@/lib/utils";
import type { TableLiveStatus } from "@/lib/floor";
import { Button } from "@/components/ui/button";
import { EmptyStateRich } from "@/components/ui/empty-state-rich";
import { LiveStrip, type LiveChip } from "@/components/overview/live-strip";
import { AIConciergePanel } from "@/components/overview/ai-concierge-panel";
import {
  ServiceTimeline,
  type TimelineRow,
  type PredictiveSlot,
} from "@/components/overview/service-timeline";
import { FloorLive } from "@/components/floor/floor-live";
import type { BookingStatusKey } from "@/components/ui/status-pill";
import { cn } from "@/lib/utils";

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
        // Solo entry recenti (entro 4h): scarta seed/demo stantii
        createdAt: { gte: new Date(Date.now() - 4 * 60 * 60_000) },
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
    db.table.findMany({
      where: { venueId: ctx.venueId },
      select: {
        id: true,
        label: true,
        seats: true,
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

  const floorTables = allTables.map((t) => {
    const b = bookingByTable.get(t.id);
    let status: TableLiveStatus = "free";
    let guestName: string | null = null;
    let bookingId: string | null = null;
    let startsAt: string | null = null;
    let partySize: number | null = null;
    if (b) {
      if (b.status === "SEATED") status = "seated";
      else if (b.status === "ARRIVED") status = "arrived";
      else status = "reserved";
      guestName = b.guest
        ? `${b.guest.firstName} ${b.guest.lastName ?? ""}`.trim()
        : "Walk-in";
      bookingId = b.id;
      startsAt = b.startsAt.toISOString();
      partySize = b.partySize;
    }
    return {
      id: t.id,
      label: t.label,
      seats: t.seats,
      shape: t.shape,
      posX: t.posX,
      posY: t.posY,
      rotation: t.rotation,
      status,
      guestName,
      bookingId,
      startsAt,
      partySize,
    };
  });

  // Upcoming 30min
  const upcoming30 = data.todayBookings.filter((b) => {
    const min = (new Date(b.startsAt).getTime() - now.getTime()) / 60_000;
    return min >= -5 && min <= 30 && (b.status === "CONFIRMED" || b.status === "PENDING");
  });

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
  const vips = data.todayBookings.filter(
    (b) => b.guest && (b.guest.loyaltyTier === "VIP" || b.guest.loyaltyTier === "AMBASSADOR"),
  );
  const birthdays = data.todayBookings.filter((b) => b.occasion === "BIRTHDAY");
  const allergies = data.todayBookings.filter((b) => b.guest?.allergies);

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
  const avgWaitLabel = formatWait(avgWaitMin);

  // Service status
  const serviceStatus =
    occupancyPct >= 85
      ? { label: "Pieno", tone: "danger" as const }
      : occupancyPct >= 50
        ? { label: "In corso", tone: "warning" as const }
        : seatsOnsite > 0
          ? { label: "Attivo", tone: "success" as const }
          : { label: "In attesa", tone: "neutral" as const };

  // Live strip (6 chip XL)
  const liveChips: LiveChip[] = [
    {
      key: "arrivals",
      label: "Arrivi 30min",
      value: String(upcoming30.length),
      hint: upcoming30.length > 0 ? "ospiti in arrivo" : "nessun arrivo",
      icon: UserCheck,
      href: "/bookings",
      tone: upcoming30.length > 0 ? "success" : "neutral",
      pulse: upcoming30.length > 0,
    },
    {
      key: "vip",
      label: "VIP oggi",
      value: String(vips.length),
      hint: vips.length > 0 ? "ospiti premium" : "nessun VIP",
      icon: Crown,
      href: "/guests?segment=vip",
      tone: vips.length > 0 ? "vip" : "neutral",
    },
    {
      key: "occupancy",
      label: "Occupazione",
      value: `${occupancyPct}%`,
      hint: `${seatsOnsite}/${totalSeats} posti`,
      icon: LayoutPanelLeft,
      href: "/floor?mode=live",
      tone:
        occupancyPct >= 85
          ? "danger"
          : occupancyPct >= 65
            ? "warning"
            : occupancyPct >= 30
              ? "success"
              : "neutral",
    },
    {
      key: "noshow",
      label: "No-show risk",
      value: String(noShowRisk.length),
      hint: noShowRisk.length > 0 ? "monitorare" : "nessun rischio",
      icon: TriangleAlert,
      href: "/bookings",
      tone: noShowRisk.length > 0 ? "danger" : "neutral",
    },
    {
      key: "waitlist",
      label: "In coda",
      value: String(waitlist.length),
      hint: waitlist.length > 0 ? `${avgWaitLabel} attesa media` : "lista vuota",
      icon: Hourglass,
      href: "/waitlist",
      tone: waitlist.length > 0 ? "warning" : "neutral",
      pulse: waitlist.length > 0,
    },
    {
      key: "service",
      label: "Servizio",
      value: serviceStatus.label,
      hint: `${data.todayBookings.length} prenotazioni · ${data.totalCovers} coperti`,
      icon: PhoneCall,
      href: "/now",
      tone: serviceStatus.tone,
      pulse: seatsOnsite > 0,
    },
  ];

  // Timeline rows
  const timelineRows: TimelineRow[] = data.todayBookings.slice(0, 16).map((b) => ({
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

  // Predictive slots se timeline vuota
  const hour = now.getHours();
  const predictive: PredictiveSlot[] =
    timelineRows.length === 0
      ? buildPredictive(hour, vips.length, waitlist.length)
      : [];

  // Spotlight item (first VIP / birthday / allergy)
  const spotlight =
    vips[0] ?? birthdays[0] ?? allergies[0] ?? null;
  const spotlightReason: "vip" | "birthday" | "allergy" | null = vips[0]
    ? "vip"
    : birthdays[0]
      ? "birthday"
      : allergies[0]
        ? "allergy"
        : null;

  const todayLabel = new Date().toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const firstName = ctx.session.user?.name?.split(" ")[0] ?? "ospite";

  return (
    <div className="space-y-5 animate-fade-in">
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

      {/* ── Live strip full-width XL ──────────────────────────────────── */}
      <LiveStrip chips={liveChips} />

      {/* ── Main grid 70/30 ───────────────────────────────────────────── */}
      <section className="grid gap-5 xl:grid-cols-[2.3fr_1fr]">
        {/* TIMELINE DARK HERO */}
        <section className="flex flex-col rounded-2xl border border-white/8 bg-carbon-800 text-sand-50 shadow-elevated">
          <header className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 px-6 py-5">
            <div>
              <p className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-gilt-light">
                Servizio di oggi
              </p>
              <h2 className="text-display mt-1 text-[26px] font-medium leading-none">
                Timeline live
              </h2>
              <p className="mt-1.5 text-sm text-sand-50/55">
                <span className="text-numeric text-sand-50">
                  {data.todayBookings.length}
                </span>{" "}
                prenotazioni ·{" "}
                <span className="text-numeric text-sand-50">{data.totalCovers}</span>{" "}
                coperti · refresh ogni 30s
              </p>
            </div>
            <Link
              href="/bookings"
              className="inline-flex items-center gap-1.5 rounded-md border border-white/15 px-3 py-1.5 text-xs font-medium text-sand-50/85 transition-colors hover:bg-white/5"
            >
              Tutte le prenotazioni <ArrowRight className="h-3 w-3" />
            </Link>
          </header>
          <div className="px-5 py-4">
            <ServiceTimeline
              rows={timelineRows}
              predictiveSlots={predictive}
              variant="dark"
            />
          </div>
        </section>

        {/* RIGHT COLUMN */}
        <div className="flex flex-col gap-4">
          {/* AI CONCIERGE */}
          <AIConciergePanel
            summary={brief.summary}
            suggestions={brief.suggestions}
            generatedBy={brief.generatedBy}
            variant="dark"
          />

          {/* WAITLIST big timers */}
          <section className="rounded-2xl border border-border bg-card">
            <header className="flex items-end justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <p className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-tertiary">
                  Lista d&apos;attesa
                </p>
                <h2 className="text-display mt-0.5 text-xl font-medium leading-none">
                  {waitlist.length === 0 ? "Coda vuota" : `${waitlist.length} in coda`}
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
                  title="Nessuno in coda"
                  description="Aggiungi un walk-in quando la sala è piena: notifichiamo via SMS quando il tavolo è pronto."
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
                          <div className="flex min-w-0 items-center gap-3">
                            <span
                              className={cn(
                                "text-display text-numeric grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-medium",
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
                          <div className="shrink-0 text-right">
                            <p
                              className={cn(
                                "text-display text-numeric text-2xl font-medium leading-none tabular-nums",
                                overdue ? "text-status-no-show" : "text-foreground",
                              )}
                            >
                              {formatWait(minutesIn)}
                            </p>
                            <p className="text-numeric mt-0.5 text-[10.5px] text-tertiary">
                              su {w.expectedWaitMin}m
                            </p>
                          </div>
                        </div>
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

          {/* Customer spotlight */}
          {spotlight && spotlightReason && (
            <SpotlightCard
              guestId={spotlight.guestId}
              bookingId={spotlight.id}
              name={
                spotlight.guest
                  ? `${spotlight.guest.firstName} ${spotlight.guest.lastName ?? ""}`.trim()
                  : "Ospite"
              }
              partySize={spotlight.partySize}
              startsAt={spotlight.startsAt.toISOString()}
              tableLabel={spotlight.table?.label ?? null}
              reason={spotlightReason}
              detail={
                spotlightReason === "allergy"
                  ? (spotlight.guest?.allergies ?? null)
                  : null
              }
            />
          )}

          {/* Alerts compact */}
          <section className="rounded-2xl border border-border bg-card">
            <header className="flex items-end justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <p className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-tertiary">
                  Alert operativi
                </p>
                <h2 className="text-display mt-0.5 text-xl font-medium leading-none">
                  {data.alerts.length === 0
                    ? "Tutto sotto controllo"
                    : `${data.alerts.length} segnalazioni`}
                </h2>
              </div>
            </header>
            <div className="px-5 py-4">
              {data.alerts.length === 0 ? (
                <p className="text-sm text-secondary leading-snug">
                  Nessuna criticità. Stiamo monitorando allergie, VIP attesi e prenotazioni senza tavolo.
                </p>
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
                        className="flex items-start gap-2.5 rounded-lg border border-border bg-[hsl(var(--surface-sunken))]/40 p-2.5"
                      >
                        <span
                          className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${tone}`}
                        >
                          <TriangleAlert className="h-3.5 w-3.5" />
                        </span>
                        <p className="text-[13px] leading-snug">{a.message}</p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        </div>
      </section>

      {/* ── BOTTOM HERO: SALA LIVE FULL-WIDTH ─────────────────────────── */}
      <section className="rounded-2xl border border-border bg-card shadow-soft">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-6 py-5">
          <div>
            <p className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-tertiary">
              Sala live
            </p>
            <h2 className="text-display mt-1 text-[26px] font-medium leading-none">
              Mappa tavoli realtime
            </h2>
            <p className="mt-1.5 text-sm text-secondary">
              <span className="text-numeric text-foreground">{tableCount}</span> tavoli ·{" "}
              <span className="text-numeric text-foreground">{tablesFreeNow}</span> liberi ·{" "}
              <span className="text-numeric text-foreground">{freeStats}</span> occupati ·{" "}
              <span className="text-numeric text-foreground">
                {floorTables.filter((t) => t.status === "reserved").length}
              </span>{" "}
              prenotati
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/floor?mode=editor">Editor</Link>
            </Button>
            <Button asChild variant="default" size="sm">
              <Link href="/floor?mode=live">
                Apri sala live <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </header>
        <div className="overflow-x-auto px-4 py-4">
          <FloorLive
            tables={floorTables}
            width={room?.width ?? 1200}
            height={room?.height ?? 760}
          />
        </div>
      </section>

      {/* ── Footer micro analytics link ───────────────────────────────── */}
      <Link
        href="/insights"
        className="group flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-6 py-4 transition-colors hover:border-border-strong"
      >
        <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
          <MiniMetric label="Coperti attesi" value={String(data.totalCovers)} />
          <MiniMetric
            label="Ricavi stimati"
            value={formatCurrency(data.estimatedRevenueCents, ctx.venue.currency)}
          />
          <MiniMetric label="No-show stimati" value={String(data.expectedNoShow)} />
          <MiniMetric label="Spesa media" value="—" />
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-secondary transition group-hover:text-foreground">
          Apri analytics cockpit <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </Link>
    </div>
  );
}

function formatWait(min: number): string {
  if (min < 0) return "0m";
  if (min < 60) return `${min}m`;
  if (min < 24 * 60) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m === 0 ? `${h}h` : `${h}h${m.toString().padStart(2, "0")}`;
  }
  return ">24h";
}

function buildPredictive(hour: number, _vips: number, _waitlist: number): PredictiveSlot[] {
  // Stime semplici basate sull'ora corrente, da raffinare con storico reale
  const isLunch = hour >= 11 && hour < 15;
  const isDinner = hour >= 18 && hour < 23;
  const isPrep = !isLunch && !isDinner;

  if (isPrep) {
    return [
      { time: "12:30", label: "Peak pranzo previsto", hint: "Storicamente 18-24 coperti", kind: "peak" },
      { time: "13:15", label: "Apertura walk-in", hint: "Picco arrivi senza prenotazione", kind: "walkin" },
      { time: "14:30", label: "Slot ridotto", hint: "Dopo le 14:30 calo prenotazioni", kind: "free" },
      { time: "19:00", label: "Apertura cena", hint: "Ricontrolla VIP entro le 18:30", kind: "ai" },
    ];
  }

  if (isLunch) {
    return [
      { time: "13:30", label: "Tavoli prevedibili in uscita", hint: "Coperti che si liberano nei prossimi 30min", kind: "free" },
      { time: "14:00", label: "Walk-in stimati", hint: "2-3 ospiti attesi senza prenotazione", kind: "walkin" },
    ];
  }

  return [
    { time: "20:00", label: "Peak cena", hint: "Massima pressione sulle prenotazioni", kind: "peak" },
    { time: "21:30", label: "Secondo turno", hint: "Possibile rotazione tavoli", kind: "free" },
    { time: "22:30", label: "Suggerisci dessert ai VIP", hint: "Loyalty marker: aumenta scontrino medio", kind: "ai" },
  ];
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-tertiary">
        {label}
      </p>
      <p className="text-display text-numeric mt-0.5 text-lg font-medium leading-none">
        {value}
      </p>
    </div>
  );
}

function SpotlightCard({
  guestId,
  bookingId,
  name,
  partySize,
  startsAt,
  tableLabel,
  reason,
  detail,
}: {
  guestId: string | null;
  bookingId: string;
  name: string;
  partySize: number;
  startsAt: string;
  tableLabel: string | null;
  reason: "vip" | "birthday" | "allergy";
  detail: string | null;
}) {
  const meta = {
    vip: {
      label: "Customer Spotlight",
      icon: Crown,
      tone: "border-status-vip/30 bg-status-vip-soft/40",
      iconCls: "text-status-vip",
    },
    birthday: {
      label: "Compleanno in arrivo",
      icon: Cake,
      tone: "border-gilt/30 bg-gilt/10",
      iconCls: "text-gilt-dark",
    },
    allergy: {
      label: "Allergia da gestire",
      icon: TriangleAlert,
      tone: "border-status-no-show/30 bg-status-no-show-soft/40",
      iconCls: "text-status-no-show",
    },
  }[reason];
  const Icon = meta.icon;
  const time = new Date(startsAt).toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const href = guestId ? `/guests/${guestId}` : `/bookings/${bookingId}`;

  return (
    <Link
      href={href}
      className={cn("group flex items-start gap-3 rounded-2xl border p-4 transition-colors", meta.tone)}
    >
      <span
        className={cn(
          "grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-card",
          meta.iconCls,
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-tertiary">
          {meta.label}
        </p>
        <p className="mt-1 text-[15px] font-medium leading-tight">{name}</p>
        <p className="mt-1 text-xs text-secondary">
          <span className="text-numeric">{time}</span> · {partySize} pers
          {tableLabel ? ` · T${tableLabel}` : ""}
        </p>
        {detail && (
          <p className="mt-1.5 line-clamp-2 text-xs text-tertiary">{detail}</p>
        )}
      </div>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 self-center text-tertiary transition-colors group-hover:text-foreground" />
    </Link>
  );
}
