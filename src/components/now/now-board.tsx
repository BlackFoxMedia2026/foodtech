"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Crown,
  PhoneCall,
  Sparkles,
  Users,
  XCircle,
  RotateCw,
  Utensils,
} from "lucide-react";
import { cn, formatTime } from "@/lib/utils";

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

const occasionLabel: Record<string, string> = {
  BIRTHDAY: "🎂 Compleanno",
  ANNIVERSARY: "💐 Anniversario",
  BUSINESS: "💼 Lavoro",
  DATE: "💞 Romantica",
  CELEBRATION: "🥂 Celebrazione",
  OTHER: "✨ Altro",
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
  const [now, setNow] = useState(() => new Date());
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setBookings(initialBookings);
  }, [initialBookings]);

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    const refresh = setInterval(() => router.refresh(), 60_000);
    return () => clearInterval(refresh);
  }, [router]);

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

  const seatsBookedNow = onsiteSeats(buckets.onsite);
  const occupancy = totalSeats > 0 ? Math.round((seatsBookedNow / totalSeats) * 100) : 0;

  async function patch(id: string, patch: Partial<{ status: BookingStatus; tableId: string | null }>) {
    setBookings((curr) =>
      curr.map((b) => (b.id === id ? { ...b, ...patch, tableLabel: patch.tableId ? tables.find((t) => t.id === patch.tableId)?.label ?? null : b.tableLabel } : b)),
    );
    const res = await fetch(`/api/bookings/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
      headers: { "content-type": "application/json" },
    });
    if (!res.ok) {
      startTransition(() => router.refresh());
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-6 py-4">
        <div className="flex items-center gap-4">
          <Link href="/overview" className="flex items-center gap-2 text-sm text-sand-50/70 hover:text-sand-50">
            <ArrowLeft className="h-4 w-4" /> Torna in app
          </Link>
          <div className="hidden sm:block h-6 w-px bg-white/15" />
          <h1 className="text-display text-xl">
            {venueName} <span className="text-sand-50/50">· vista sala</span>
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <Stat label="Ora" value={now.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })} />
          <Stat label="In sala" value={`${seatsBookedNow}/${totalSeats}`} accent />
          <Stat label="Occupazione" value={`${occupancy}%`} accent={occupancy >= 70} />
          <button
            onClick={() => startTransition(() => router.refresh())}
            disabled={pending}
            className="rounded-md border border-white/15 px-3 py-2 text-xs hover:bg-white/5 inline-flex items-center gap-2"
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
                  <CheckCircle2 className="h-4 w-4" /> Conferma
                </ActionButton>
              )}
              <ActionButton tone="primary" onClick={() => patch(b.id, { status: "ARRIVED" })}>
                <CheckCircle2 className="h-4 w-4" /> Arrivato
              </ActionButton>
              <ActionButton tone="ghost" onClick={() => patch(b.id, { status: "NO_SHOW" })}>
                <XCircle className="h-4 w-4" /> No-show
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
                  <Utensils className="h-4 w-4" /> Seduto
                </ActionButton>
              )}
              <ActionButton tone="ghost" onClick={() => patch(b.id, { status: "COMPLETED" })}>
                <CheckCircle2 className="h-4 w-4" /> Chiudi tavolo
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
          <summary className="cursor-pointer">Servizio già chiuso ({buckets.closed.length})</summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {buckets.closed.map((b) => (
              <div key={b.id} className="rounded-md border border-white/10 px-3 py-2">
                <div className="flex justify-between">
                  <span>{guestName(b)}</span>
                  <span className="text-sand-50/50">{formatTime(b.startsAt)}</span>
                </div>
                <span className="text-[10px] uppercase tracking-wider text-sand-50/40">{b.status}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function onsiteSeats(items: Booking[]) {
  return items.reduce((acc, b) => acc + b.partySize, 0);
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-md border px-3 py-1.5",
        accent ? "border-gilt/40 bg-gilt/10" : "border-white/15",
      )}
    >
      <p className="text-[10px] uppercase tracking-wider text-sand-50/50">{label}</p>
      <p className={cn("text-base font-medium", accent && "text-gilt-light")}>{value}</p>
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
    <section className={cn("flex flex-col rounded-lg border", accent)}>
      <header className="flex items-baseline justify-between border-b border-white/10 px-4 py-3">
        <div>
          <h2 className="text-display text-base">{title}</h2>
          <p className="text-[11px] uppercase tracking-wider text-sand-50/50">{subtitle}</p>
        </div>
        <span className="rounded-full border border-white/15 px-2 py-0.5 text-xs">{items.length}</span>
      </header>
      <div className="flex flex-col gap-3 overflow-y-auto p-3">
        {items.length === 0 ? (
          <p className="rounded-md border border-dashed border-white/15 p-6 text-center text-sm text-sand-50/40">
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
  const overdue = diffMin <= -10 && (booking.status === "PENDING" || booking.status === "CONFIRMED");

  return (
    <article
      className={cn(
        "rounded-lg border bg-carbon-800/60 p-4",
        overdue ? "border-rose-400/50" : "border-white/10",
        compact && "p-3",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sand-50">
            <span className={cn("font-medium", compact ? "text-base" : "text-lg")}>
              {guestName(booking)}
            </span>
            {booking.guest?.loyaltyTier === "VIP" || booking.guest?.loyaltyTier === "AMBASSADOR" ? (
              <Crown className="h-3.5 w-3.5 text-gilt-light" />
            ) : null}
          </p>
          {booking.guest?.phone && !compact && (
            <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-sand-50/60">
              <PhoneCall className="h-3 w-3" /> {booking.guest.phone}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className={cn("text-display", compact ? "text-lg" : "text-2xl")}>{formatTime(booking.startsAt)}</p>
          <p className={cn("text-xs", overdue ? "text-rose-300" : "text-sand-50/50")}>{diffLabel}</p>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-sand-50/70">
        <span className="inline-flex items-center gap-1">
          <Users className="h-3 w-3" /> {booking.partySize}
        </span>
        {booking.tableLabel ? (
          <span className="rounded border border-white/15 px-1.5 py-0.5">Tavolo {booking.tableLabel}</span>
        ) : (
          <span className="text-amber-300/80">tavolo da assegnare</span>
        )}
        {booking.occasion && <span>{occasionLabel[booking.occasion] ?? booking.occasion}</span>}
        {booking.source === "WIDGET" && (
          <span className="inline-flex items-center gap-1 text-sand-50/50">
            <Sparkles className="h-3 w-3" /> widget
          </span>
        )}
        {!compact && booking.notes && (
          <span className="basis-full rounded border border-white/10 px-2 py-1 italic text-sand-50/60">
            “{booking.notes}”
          </span>
        )}
      </div>

      {!compact && (
        <div className="mt-3 flex items-center gap-2">
          {booking.status === "PENDING" || booking.status === "CONFIRMED" || booking.status === "ARRIVED" ? (
            <select
              value={booking.tableId ?? ""}
              onChange={(e) => onPatch(booking.id, { tableId: e.target.value || null })}
              className="rounded-md border border-white/15 bg-carbon-900/70 px-2 py-1 text-xs text-sand-50"
            >
              <option value="">— assegna tavolo —</option>
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label} · {t.seats}p
                </option>
              ))}
            </select>
          ) : null}
        </div>
      )}

      {children && <div className="mt-3 flex flex-wrap gap-2">{children}</div>}

      {compact && (
        <div className="mt-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-sand-50/40">
          <Clock className="h-3 w-3" /> {booking.status}
        </div>
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
        "inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition",
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
  if (!b.guest) return "Ospite";
  return [b.guest.firstName, b.guest.lastName].filter(Boolean).join(" ") || b.guest.firstName;
}
