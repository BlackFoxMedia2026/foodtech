import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarPlus,
  Cake,
  Crown,
  Hourglass,
  Info,
  LayoutPanelLeft,
  Plus,
  Search,
  Sparkles,
  Tv,
  TriangleAlert,
  Users,
  Zap,
} from "lucide-react";
import { db } from "@/lib/db";
import { getActiveVenue } from "@/lib/tenant";
import { getOverview } from "@/server/insights";
import { generateDailyBrief } from "@/lib/ai";
import { startOfDay, endOfDay, formatCurrency, formatTime, initials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill, type BookingStatusKey } from "@/components/ui/status-pill";
import { LiveClock } from "@/components/overview/live-clock";
import { CapacityRing } from "@/components/overview/capacity-ring";
import { NextArrival, type ArrivalRow } from "@/components/overview/next-arrival";
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
      take: 3,
      select: {
        id: true,
        guestName: true,
        partySize: true,
        expectedWaitMin: true,
        position: true,
      },
    }),
  ]);

  const totalSeats = tables.reduce((acc, t) => acc + t.seats, 0);
  const tableCount = tables.length;

  const now = new Date();
  const upcoming = data.todayBookings
    .filter(
      (b) =>
        new Date(b.startsAt).getTime() >= now.getTime() - 5 * 60_000 &&
        ["CONFIRMED", "PENDING"].includes(b.status),
    )
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  const next = upcoming[0];
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

  // Coperti in corso (in sala)
  const seatsOnsite = data.todayBookings
    .filter((b) => b.status === "ARRIVED" || b.status === "SEATED")
    .reduce((s, b) => s + b.partySize, 0);

  // Tavoli liberi adesso (approssimazione)
  const tablesOccupiedNow = freeStats;
  const tablesFreeNow = Math.max(0, tableCount - tablesOccupiedNow);

  // Occupancy %
  const occupancyPct = totalSeats > 0 ? Math.round((seatsOnsite / totalSeats) * 100) : 0;

  // VIP attesi + compleanni
  const vips = data.todayBookings.filter(
    (b) => b.guest && (b.guest.loyaltyTier === "VIP" || b.guest.loyaltyTier === "AMBASSADOR"),
  );
  const birthdays = data.todayBookings.filter((b) => b.occasion === "BIRTHDAY");
  const allergies = data.todayBookings.filter((b) => b.guest?.allergies);

  const todayLabel = new Date().toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const firstName = ctx.session.user?.name?.split(" ")[0] ?? "ospite";

  // Suggestion top
  const topSuggestion = brief.suggestions.find((s) => s.kind !== "SUMMARY");

  // Total covers expected today
  const totalCovers = data.totalCovers;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* ── HERO Service Deck ─────────────────────────── */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-soft md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-tertiary">
              {ctx.venue.name} · <span className="capitalize">{todayLabel}</span>
            </p>
            <h1 className="text-display mt-1 text-[40px] font-medium leading-none tracking-tight md:text-[48px]">
              Buongiorno, {firstName}.
            </h1>
            <p className="mt-2 max-w-md text-sm text-secondary">
              Service deck del servizio. Ora corrente, occupazione, prossimi arrivi e
              priorità di sala — sempre vivi.
            </p>
          </div>
          <Button asChild variant="gold" size="default">
            <Link href="/bookings/new">
              <CalendarPlus className="h-4 w-4" /> Nuova prenotazione
            </Link>
          </Button>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_auto_1fr]">
          {/* Ora corrente — display monumentale */}
          <div className="flex flex-col items-start justify-center">
            <p className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-tertiary">
              Ora attuale
            </p>
            <p className="text-display text-numeric mt-1 text-[88px] font-medium leading-none tracking-tight md:text-[112px]">
              <LiveClock
                initial={new Date().toLocaleTimeString("it-IT", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              />
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
              <ServiceStatusChip seated={seatsOnsite} pct={occupancyPct} />
            </div>
          </div>

          {/* Capacity ring */}
          <div className="hidden items-center justify-center lg:flex">
            <CapacityRing pct={occupancyPct} size={148} stroke={12} />
          </div>

          {/* Live tiles colonna destra */}
          <div className="grid grid-cols-3 gap-3 self-center">
            <LiveTile label="In sala" value={String(seatsOnsite)} hint="coperti adesso" />
            <LiveTile
              label="In arrivo"
              value={String(upcoming.length)}
              hint="prenotazioni"
            />
            <LiveTile
              label="Tavoli"
              value={`${tablesFreeNow}/${tableCount}`}
              hint="liberi"
            />
          </div>
        </div>
      </section>

      {/* ── AI Concierge brief ────────────────────────── */}
      {topSuggestion && (
        <Link
          href={topSuggestion.actionHref ?? "#"}
          className="group flex items-start gap-4 rounded-2xl border border-gilt/25 bg-gilt/[0.05] p-4 transition-colors hover:bg-gilt/[0.08]"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gilt/20 text-gilt-dark">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-gilt-dark">
              Concierge AI · oggi
            </p>
            <p className="mt-1 text-[15px] font-medium text-foreground">{brief.summary}</p>
            <p className="mt-1 text-sm text-secondary">{topSuggestion.title}</p>
          </div>
          {topSuggestion.actionLabel && (
            <span className="flex shrink-0 items-center gap-1 self-center text-xs font-medium text-gilt-dark opacity-0 transition-opacity group-hover:opacity-100">
              {topSuggestion.actionLabel} <ArrowRight className="h-3.5 w-3.5" />
            </span>
          )}
        </Link>
      )}

      {/* ── Quick actions ────────────────────────────── */}
      <section className="space-y-2">
        <SectionLabel>Azioni rapide</SectionLabel>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <QuickAction
            href="/bookings/new"
            icon={<Plus className="h-4 w-4" />}
            label="Nuova prenotazione"
            tone="gold"
          />
          <QuickAction
            href="/bookings?walkin=1"
            icon={<Zap className="h-4 w-4" />}
            label="Walk-in rapido"
          />
          <QuickAction
            href="/guests"
            icon={<Search className="h-4 w-4" />}
            label="Cerca ospite"
          />
          <QuickAction
            href="/now"
            icon={<Tv className="h-4 w-4" />}
            label="Sala live"
          />
        </div>
      </section>

      {/* ── Prossimo arrivo + ospiti speciali ────────── */}
      <section className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <SectionLabel>Prossimo arrivo</SectionLabel>
          <NextArrival next={nextRow} />
        </div>

        <div className="space-y-2">
          <SectionLabel>Ospiti speciali oggi</SectionLabel>
          <SpecialsBar
            vips={vips.length}
            birthdays={birthdays.length}
            allergies={allergies.length}
          />
        </div>
      </section>

      {/* ── Waitlist + Alert operativi ───────────────── */}
      <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Panel>
          <PanelHeader
            title={
              <span className="inline-flex items-center gap-2">
                <Hourglass className="h-4 w-4 text-tertiary" /> Lista d&apos;attesa
              </span>
            }
            description={
              waitlist.length === 0
                ? "Nessuno in attesa"
                : `${waitlist.length}+ ${waitlist.length === 1 ? "ospite" : "ospiti"} in coda`
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
              <EmptyState
                icon={Hourglass}
                title="Lista d'attesa vuota"
                description="Aggiungi un walk-in alla coda quando la sala è piena."
              />
            ) : (
              <ul className="divide-y divide-border">
                {waitlist.map((w) => (
                  <li
                    key={w.id}
                    className="flex items-center gap-3 py-2.5 text-sm"
                  >
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-secondary text-numeric text-xs font-medium">
                      {w.position || "—"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{w.guestName}</p>
                      <p className="text-xs text-tertiary">
                        {w.partySize} pers · attesa ~{w.expectedWaitMin}m
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            title={
              <span className="inline-flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-tertiary" /> Alert operativi
              </span>
            }
            description="Cose da risolvere prima del servizio"
          />
          <PanelBody className="pt-0">
            {data.alerts.length === 0 ? (
              <EmptyState
                icon={Sparkles}
                title="Tutto sotto controllo"
                description="Nessuna criticità per il servizio di oggi."
              />
            ) : (
              <ul className="space-y-2">
                {data.alerts.slice(0, 5).map((a, i) => (
                  <AlertRow key={i} kind={a.kind} message={a.message} />
                ))}
              </ul>
            )}
          </PanelBody>
        </Panel>
      </section>

      {/* ── Today timeline list ──────────────────────── */}
      <Panel>
        <PanelHeader
          title="Prenotazioni di oggi"
          description={`${data.todayBookings.length} prenotazioni · ${totalCovers} coperti attesi`}
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
          {data.todayBookings.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Nessuna prenotazione oggi"
              description="Appena entra qualcosa in agenda lo vedi qui."
            />
          ) : (
            <ul className="divide-y divide-border">
              {data.todayBookings.slice(0, 8).map((b) => {
                const guestName = b.guest
                  ? `${b.guest.firstName} ${b.guest.lastName ?? ""}`.trim()
                  : "Walk-in";
                const isVip =
                  b.guest?.loyaltyTier === "VIP" ||
                  b.guest?.loyaltyTier === "AMBASSADOR";
                return (
                  <li key={b.id}>
                    <Link
                      href={`/bookings/${b.id}`}
                      className="-mx-2 flex items-center gap-4 rounded-md px-2 py-2.5 transition-colors hover:bg-secondary/40"
                    >
                      <div className="w-14 text-right">
                        <p className="text-display text-numeric text-base font-medium">
                          {formatTime(b.startsAt)}
                        </p>
                        <p className="text-[10px] uppercase tracking-wider text-tertiary">
                          {b.durationMin} min
                        </p>
                      </div>
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-[10.5px]">
                          {initials(guestName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                          {guestName}
                          {isVip && <Crown className="h-3 w-3 shrink-0 text-gilt-dark" />}
                        </p>
                        <p className="truncate text-xs text-tertiary">
                          {b.table?.label ? `Tavolo ${b.table.label}` : "Tavolo da assegnare"}
                          {b.notes ? ` · ${b.notes}` : ""}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1 text-xs text-numeric text-secondary">
                        <Users className="h-3.5 w-3.5 text-tertiary" />
                        {b.partySize}
                      </span>
                      <StatusPill status={b.status as BookingStatusKey} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </PanelBody>
      </Panel>

      {/* ── Footer analytics strip ───────────────────── */}
      <Link
        href="/insights"
        className="group flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-5 py-4 transition-colors hover:border-border-strong"
      >
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <MiniMetric
            label="Coperti attesi"
            value={String(totalCovers)}
          />
          <MiniMetric
            label="Ricavi stimati"
            value={formatCurrency(data.estimatedRevenueCents, ctx.venue.currency)}
          />
          <MiniMetric
            label="No-show stimati"
            value={String(data.expectedNoShow)}
          />
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-secondary transition group-hover:text-foreground">
          Analytics complete <ArrowRight className="h-3 w-3" />
        </span>
      </Link>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-tertiary">
      {children}
    </p>
  );
}

function ServiceStatusChip({ seated, pct }: { seated: number; pct: number }) {
  const tone =
    pct >= 85
      ? { dot: "bg-status-no-show", text: "Servizio pieno" }
      : pct >= 50
        ? { dot: "bg-status-pending", text: "Servizio in corso" }
        : seated > 0
          ? { dot: "bg-status-confirmed", text: "Servizio attivo" }
          : { dot: "bg-tertiary", text: "Sala vuota" };

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[12.5px] font-medium">
      <span className="relative inline-flex h-2 w-2">
        {seated > 0 && (
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-50 ${tone.dot}`}
          />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${tone.dot}`} />
      </span>
      {tone.text}
    </span>
  );
}

function LiveTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-[hsl(var(--surface-sunken))]/50 px-3 py-3 text-center">
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-tertiary">
        {label}
      </p>
      <p className="text-display text-numeric mt-1 text-2xl font-medium leading-none">
        {value}
      </p>
      <p className="mt-0.5 text-[10.5px] text-tertiary">{hint}</p>
    </div>
  );
}

function SpecialsBar({
  vips,
  birthdays,
  allergies,
}: {
  vips: number;
  birthdays: number;
  allergies: number;
}) {
  const hasAny = vips > 0 || birthdays > 0 || allergies > 0;
  if (!hasAny) {
    return (
      <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-secondary">
        Nessuna nota speciale per il servizio di oggi.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-3 gap-2 rounded-xl border border-border bg-card p-2">
      <SpecialChip
        label="VIP"
        value={vips}
        icon={<Crown className="h-3.5 w-3.5" />}
        tone="vip"
      />
      <SpecialChip
        label="Compleanni"
        value={birthdays}
        icon={<Cake className="h-3.5 w-3.5" />}
        tone="gold"
      />
      <SpecialChip
        label="Allergie"
        value={allergies}
        icon={<TriangleAlert className="h-3.5 w-3.5" />}
        tone="danger"
      />
    </div>
  );
}

function SpecialChip({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: "vip" | "gold" | "danger";
}) {
  const cls =
    tone === "vip"
      ? "text-status-vip"
      : tone === "gold"
        ? "text-gilt-dark"
        : "text-status-no-show";
  return (
    <div className="flex items-center gap-2 rounded-lg bg-[hsl(var(--surface-sunken))]/50 px-2.5 py-2">
      <span className={`grid h-7 w-7 place-items-center rounded-full bg-card ${cls}`}>
        {icon}
      </span>
      <div>
        <p className="text-display text-numeric text-base font-medium leading-none">
          {value}
        </p>
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-tertiary">
          {label}
        </p>
      </div>
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

function QuickAction({
  href,
  icon,
  label,
  tone,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  tone?: "gold";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-sm font-medium transition-colors",
        tone === "gold"
          ? "border-gilt/30 bg-gilt/10 text-gilt-dark hover:bg-gilt/15"
          : "border-border bg-card text-foreground hover:border-border-strong",
      )}
    >
      <span
        className={cn(
          "grid h-7 w-7 place-items-center rounded-lg",
          tone === "gold" ? "bg-gilt/20" : "bg-[hsl(var(--surface-sunken))]",
        )}
      >
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </Link>
  );
}

function AlertRow({ kind, message }: { kind: string; message: string }) {
  const Icon = kind === "danger" ? TriangleAlert : kind === "info" ? Sparkles : Info;
  const tone =
    kind === "danger"
      ? "text-status-no-show bg-status-no-show-soft"
      : kind === "info"
        ? "text-gilt-dark bg-gilt/10"
        : "text-status-pending bg-status-pending-soft";
  const iconCls =
    kind === "danger"
      ? "text-status-no-show"
      : kind === "info"
        ? "text-gilt-dark"
        : "text-status-pending";
  return (
    <li className="flex items-start gap-2.5 rounded-lg border border-border bg-card p-3">
      <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full", tone)}>
        <Icon className={cn("h-3.5 w-3.5", iconCls)} />
      </span>
      <p className="text-sm text-foreground leading-snug">{message}</p>
    </li>
  );
}
