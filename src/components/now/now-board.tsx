"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useRealtimeNow } from "@/components/providers/realtime-sync";
import {
  ArrowLeft,
  CheckCircle2,
  Crown,
  PhoneCall,
  RotateCw,
  Sparkles,
  Users,
  Utensils,
  XCircle,
} from "lucide-react";
import { cn, formatTime } from "@/lib/utils";
import { WalkInButton } from "@/components/now/walk-in-button";

type LoyaltyTier = "NEW" | "REGULAR" | "VIP" | "AMBASSADOR";
type BookingStatus = "PENDING" | "CONFIRMED" | "ARRIVED" | "SEATED" | "COMPLETED" | "NO_SHOW" | "CANCELLED";
type BookingSource = "WIDGET" | "PHONE" | "WALK_IN" | "GOOGLE" | "SOCIAL" | "CONCIERGE" | "EVENT";

type Booking = {
  id: string;
  reference: string;
  partySize: number;
  startsAt: string;
  durationMin: number;
  status: BookingStatus;
  source: BookingSource;
  occasion: string | null;
  notes: string | null;
  tableId: string | null;
  tableLabel: string | null;
  guest: {
    firstName: string;
    lastName: string | null;
    phone: string | null;
    loyaltyTier: LoyaltyTier;
  } | null;
};

type Table = { id: string; label: string; seats: number };

const OCCASION_LABEL: Record<string, string> = {
  BIRTHDAY: "Compleanno",
  ANNIVERSARY: "Anniversario",
  BUSINESS: "Lavoro",
  DATE: "Romantica",
  CELEBRATION: "Celebrazione",
  OTHER: "Altro",
};

const STATUS_LABEL: Record<BookingStatus, string> = {
  PENDING: "In attesa",
  CONFIRMED: "Confermata",
  ARRIVED: "Arrivato",
  SEATED: "Al tavolo",
  COMPLETED: "Completata",
  NO_SHOW: "No-show",
  CANCELLED: "Annullata",
};

export function NowBoard({
  venueName,
  totalSeats,
  tables,
  bookings: initialBookings,
}: {
  venueName: string;
  totalSeats: number;
  tables: Table[];
  bookings: Booking[];
}) {
  const router = useRouter();
  const [bookings, setBookings] = useState(initialBookings);
  // `now` is driven by the centralised RealtimeSyncProvider — see
  // `src/components/providers/realtime-sync.tsx`. That provider also
  // calls `router.refresh()` on the shared 30s tick, so we don't
  // schedule a second 60s refresh from this component.
  const now = useRealtimeNow();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setBookings(initialBookings);
  }, [initialBookings]);

  const buckets = useMemo(() => {
    const upcoming: Booking[] = [];
    const onsite: Booking[] = [];
    const later: Booking[] = [];
    const closed: Booking[] = [];
    const t = now.getTime();
    for (const b of bookings) {
      const start = new Date(b.startsAt).getTime();
      const diffMin = (start - t) / 60_000;
      if (b.status === "ARRIVED" || b.status === "SEATED") onsite.push(b);
      else if (b.status === "COMPLETED" || b.status === "NO_SHOW" || b.status === "CANCELLED") closed.push(b);
      else if (diffMin <= 90 && diffMin >= -30) upcoming.push(b);
      else later.push(b);
    }
    return { upcoming, onsite, later, closed };
  }, [bookings, now]);

  const seatsBookedNow = buckets.onsite.reduce((acc, b) => acc + b.partySize, 0);
  const occupancy = totalSeats > 0 ? Math.round((seatsBookedNow / totalSeats) * 100) : 0;

  async function patch(
    id: string,
    patchData: Partial<{ status: BookingStatus; tableId: string | null }>,
  ) {
    setBookings((curr) =>
      curr.map((b) =>
        b.id === id
          ? {
              ...b,
              ...patchData,
              tableLabel: patchData.tableId
                ? tables.find((t) => t.id === patchData.tableId)?.label ?? null
                : b.tableLabel,
            }
          : b,
      ),
    );
    const res = await fetch(`/api/bookings/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patchData),
      headers: { "content-type": "application/json" },
    });
    if (!res.ok) startTransition(() => router.refresh());
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-6 py-4">
        <div className="flex items-center gap-4">
          <Link
            href="/overview"
            className="inline-flex items-center gap-1.5 text-xs text-sand-50/60 transition-colors hover:text-sand-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> App
          </Link>
          <div className="hidden h-5 w-px bg-white/15 sm:block" />
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-sand-50/45">
              Vista sala
            </p>
            <h1 className="text-display text-lg font-medium leading-tight">{venueName}</h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LiveStat
            label="Ora"
            value={now.toLocaleTimeString("it-IT", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          />
          <LiveStat label="In sala" value={`${seatsBookedNow}/${totalSeats}`} accent />
          <LiveStat label="Occupazione" value={`${occupancy}%`} accent={occupancy >= 70} />
          <WalkInButton tables={tables} />
          <button
            onClick={() => startTransition(() => router.refresh())}
            disabled={pending}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-white/15 px-3 text-xs transition hover:bg-white/5"
          >
            <RotateCw className={cn("h-3.5 w-3.5", pending && "animate-spin")} /> Aggiorna
          </button>
        </div>
      </header>

      <div className="grid flex-1 gap-4 p-4 lg:grid-cols-3 lg:p-6">
        <Column
          title="In arrivo"
          subtitle="prossimi 90 minuti"
          tone="gold"
          empty="Nessun arrivo previsto a breve."
          items={buckets.upcoming}
          render={(b) => (
            <BookingCard booking={b} now={now} tables={tables} onPatch={patch}>
              {b.status === "PENDING" && (
                <ActionButton tone="primary" onClick={() => patch(b.id, { status: "CONFIRMED" })}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Conferma
                </ActionButton>
              )}
              <ActionButton tone="primary" onClick={() => patch(b.id, { status: "ARRIVED" })}>
                <CheckCircle2 className="h-3.5 w-3.5" /> Arrivato
              </ActionButton>
              <ActionButton tone="ghost" onClick={() => patch(b.id, { status: "NO_SHOW" })}>
                <XCircle className="h-3.5 w-3.5" /> No-show
              </ActionButton>
            </BookingCard>
          )}
        />

        <Column
          title="In sala"
          subtitle="ospiti attivi adesso"
          tone="emerald"
          empty="Sala vuota."
          items={buckets.onsite}
          render={(b) => (
            <BookingCard booking={b} now={now} tables={tables} onPatch={patch}>
              {b.status === "ARRIVED" && (
                <ActionButton tone="primary" onClick={() => patch(b.id, { status: "SEATED" })}>
                  <Utensils className="h-3.5 w-3.5" /> Seduto
                </ActionButton>
              )}
              <ActionButton tone="ghost" onClick={() => patch(b.id, { status: "COMPLETED" })}>
                <CheckCircle2 className="h-3.5 w-3.5" /> Chiudi
              </ActionButton>
            </BookingCard>
          )}
        />

        <Column
          title="Più tardi oggi"
          subtitle={`${buckets.later.length} prenotazioni`}
          tone="muted"
          empty="Niente altro in programma oggi."
          items={buckets.later}
          render={(b) => <BookingCard booking={b} now={now} tables={tables} onPatch={patch} compact />}
        />
      </div>

      {buckets.closed.length > 0 && (
        <details className="border-t border-white/10 px-6 py-3 text-xs text-sand-50/60">
          <summary className="cursor-pointer select-none">
            Servizio già chiuso ({buckets.closed.length})
          </summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {buckets.closed.map((b) => (
              <div
                key={b.id}
                className="rounded-md border border-white/10 px-3 py-2 text-[11px]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{guestName(b)}</span>
                  <span className="text-sand-50/45 text-numeric">{formatTime(b.startsAt)}</span>
                </div>
                <span className="mt-0.5 inline-block text-[10px] uppercase tracking-wider text-sand-50/35">
                  {STATUS_LABEL[b.status]}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function LiveStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-1.5 leading-tight",
        accent ? "border-gilt/40 bg-gilt/10" : "border-white/15 bg-white/[0.02]",
      )}
    >
      <p className="text-[9.5px] font-medium uppercase tracking-[0.14em] text-sand-50/45">
        {label}
      </p>
      <p
        className={cn(
          "text-display text-numeric text-base font-medium",
          accent && "text-gilt-light",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Column({
  title,
  subtitle,
  tone,
  items,
  empty,
  render,
}: {
  title: string;
  subtitle: string;
  tone: "gold" | "emerald" | "muted";
  items: Booking[];
  empty: string;
  render: (b: Booking) => React.ReactNode;
}) {
  const accent =
    tone === "gold"
      ? "border-gilt/30 bg-gilt/5"
      : tone === "emerald"
        ? "border-emerald-400/30 bg-emerald-400/5"
        : "border-white/15 bg-white/[0.02]";
  return (
    <section className={cn("flex flex-col rounded-xl border", accent)}>
      <header className="flex items-baseline justify-between border-b border-white/10 px-4 py-3">
        <div>
          <h2 className="text-display text-base font-medium">{title}</h2>
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-sand-50/45">
            {subtitle}
          </p>
        </div>
        <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10.5px] text-numeric">
          {items.length}
        </span>
      </header>
      <div className="flex flex-col gap-2.5 overflow-y-auto p-3">
        {items.length === 0 ? (
          <p className="rounded-md border border-dashed border-white/12 p-6 text-center text-xs text-sand-50/40">
            {empty}
          </p>
        ) : (
          items.map(render)
        )}
      </div>
    </section>
  );
}

function BookingCard({
  booking,
  now,
  tables,
  onPatch,
  children,
  compact,
}: {
  booking: Booking;
  now: Date;
  tables: Table[];
  onPatch: (id: string, p: Partial<{ status: BookingStatus; tableId: string | null }>) => void;
  children?: React.ReactNode;
  compact?: boolean;
}) {
  const start = new Date(booking.startsAt);
  const diffMin = Math.round((start.getTime() - now.getTime()) / 60_000);
  const diffLabel =
    diffMin >= 60
      ? `tra ${Math.floor(diffMin / 60)}h ${diffMin % 60}m`
      : diffMin > 0
        ? `tra ${diffMin}m`
        : diffMin === 0
          ? "adesso"
          : `${-diffMin}m fa`;
  const overdue =
    diffMin <= -10 && (booking.status === "PENDING" || booking.status === "CONFIRMED");
  const isVip =
    booking.guest?.loyaltyTier === "VIP" || booking.guest?.loyaltyTier === "AMBASSADOR";

  return (
    <article
      className={cn(
        "rounded-lg border bg-carbon-800/55 px-3.5 py-3 transition-colors",
        overdue ? "border-rose-400/50 ring-1 ring-rose-400/20" : "border-white/8",
        compact && "px-3 py-2.5",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5">
            <span
              className={cn(
                "truncate font-medium text-sand-50",
                compact ? "text-sm" : "text-[15.5px]",
              )}
            >
              {guestName(booking)}
            </span>
            {isVip && <Crown className="h-3.5 w-3.5 shrink-0 text-gilt-light" />}
          </p>
          {booking.guest?.phone && !compact && (
            <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-sand-50/55">
              <PhoneCall className="h-3 w-3" /> {booking.guest.phone}
            </p>
          )}
        </div>
        <div className="text-right">
          <p
            className={cn(
              "text-display text-numeric font-medium leading-none",
              compact ? "text-base" : "text-2xl",
            )}
          >
            {formatTime(booking.startsAt)}
          </p>
          <p
            className={cn(
              "mt-0.5 text-[10.5px] text-numeric",
              overdue ? "text-rose-300" : "text-sand-50/45",
            )}
          >
            {diffLabel}
          </p>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-sand-50/65">
        <span className="inline-flex items-center gap-1">
          <Users className="h-3 w-3" /> {booking.partySize}
        </span>
        {booking.tableLabel ? (
          <span className="rounded border border-white/15 bg-white/[0.04] px-1.5 py-0.5 text-numeric">
            T {booking.tableLabel}
          </span>
        ) : (
          <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-amber-200">
            tavolo libero
          </span>
        )}
        {booking.occasion && (
          <span className="rounded bg-white/[0.04] px-1.5 py-0.5 text-sand-50/65">
            {OCCASION_LABEL[booking.occasion] ?? booking.occasion}
          </span>
        )}
        {booking.source === "WIDGET" && (
          <span className="inline-flex items-center gap-1 text-sand-50/45">
            <Sparkles className="h-3 w-3" /> widget
          </span>
        )}
      </div>

      {!compact && booking.notes && (
        <p className="mt-2 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5 text-[11.5px] italic text-sand-50/65">
          “{booking.notes}”
        </p>
      )}

      {!compact && (booking.status === "PENDING" || booking.status === "CONFIRMED" || booking.status === "ARRIVED") && (
        <div className="mt-2.5">
          <select
            value={booking.tableId ?? ""}
            onChange={(e) => onPatch(booking.id, { tableId: e.target.value || null })}
            className="h-8 rounded-md border border-white/15 bg-carbon-900/70 px-2 text-[11.5px] text-sand-50 outline-none focus:border-gilt/40"
          >
            <option value="">— assegna tavolo —</option>
            {tables.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label} · {t.seats}p
              </option>
            ))}
          </select>
        </div>
      )}

      {children && <div className="mt-2.5 flex flex-wrap gap-2">{children}</div>}

      {compact && (
        <p className="mt-1.5 text-[10px] uppercase tracking-[0.14em] text-sand-50/40">
          {STATUS_LABEL[booking.status]}
        </p>
      )}
    </article>
  );
}

function ActionButton({
  tone,
  onClick,
  children,
}: {
  tone: "primary" | "ghost";
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition",
        tone === "primary"
          ? "bg-gilt text-carbon-900 hover:bg-gilt-light"
          : "border border-white/15 text-sand-50/80 hover:bg-white/5",
      )}
    >
      {children}
    </button>
  );
}

function guestName(b: Booking) {
  if (!b.guest) return "Walk-in";
  const name = [b.guest.firstName, b.guest.lastName].filter(Boolean).join(" ");
  return name || b.guest.firstName;
}
