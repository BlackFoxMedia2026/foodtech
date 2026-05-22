"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Crown,
  Sparkles,
  TrendingUp,
  Users,
  Utensils,
  Zap,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusPill, type BookingStatusKey } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import { formatTime, initials } from "@/lib/utils";
import { cn } from "@/lib/utils";

export type TimelineRow = {
  id: string;
  startsAt: string;
  durationMin: number;
  partySize: number;
  status: BookingStatusKey;
  isVip: boolean;
  guestName: string;
  tableLabel: string | null;
  notes: string | null;
};

export type PredictiveSlot = {
  time: string; // HH:MM
  label: string;
  hint: string;
  kind: "peak" | "free" | "ai" | "walkin";
};

function diffMinutes(target: string, now: Date) {
  return Math.round((new Date(target).getTime() - now.getTime()) / 60_000);
}

function diffLabel(min: number) {
  if (min <= -60) return `${Math.floor(-min / 60)}h ${(-min) % 60}m fa`;
  if (min < -1) return `${-min} min fa`;
  if (min <= 0) return "adesso";
  if (min < 60) return `tra ${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `tra ${h}h` : `tra ${h}h ${m}m`;
}

export function ServiceTimeline({
  rows,
  predictiveSlots = [],
  variant = "light",
}: {
  rows: TimelineRow[];
  predictiveSlots?: PredictiveSlot[];
  variant?: "light" | "dark";
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const dark = variant === "dark";

  if (rows.length === 0) {
    return (
      <PredictiveEmpty
        slots={predictiveSlots}
        dark={dark}
      />
    );
  }

  return (
    <ul className={cn("divide-y", dark ? "divide-white/8" : "divide-border")}>
      {rows.map((b) => {
        const min = diffMinutes(b.startsAt, now);
        const imminent = min >= -5 && min <= 15;
        const overdue =
          min <= -10 && (b.status === "CONFIRMED" || b.status === "PENDING");
        return (
          <li key={b.id}>
            <Link
              href={`/bookings/${b.id}`}
              className={cn(
                "-mx-1 flex items-center gap-4 rounded-md px-1 py-3.5 transition-colors",
                dark ? "hover:bg-white/[0.04]" : "hover:bg-secondary/40",
                overdue && (dark ? "bg-rose-500/10" : "bg-status-no-show-soft/30"),
                imminent && !overdue && (dark ? "bg-emerald-400/[0.06]" : ""),
              )}
            >
              {/* Time column */}
              <div className="w-20 shrink-0">
                <p
                  className={cn(
                    "text-display text-numeric text-2xl font-medium leading-none tabular-nums",
                    dark ? "text-sand-50" : "text-foreground",
                  )}
                >
                  {formatTime(b.startsAt)}
                </p>
                <p
                  className={cn(
                    "mt-1 text-[11px] text-numeric font-medium",
                    overdue
                      ? "text-rose-400"
                      : imminent
                        ? dark
                          ? "text-emerald-300"
                          : "text-status-confirmed"
                        : dark
                          ? "text-sand-50/45"
                          : "text-tertiary",
                  )}
                >
                  {diffLabel(min)}
                </p>
              </div>

              <div
                className={cn(
                  "h-12 w-px shrink-0",
                  dark ? "bg-white/10" : "bg-border",
                )}
              />

              <Avatar className="h-11 w-11 shrink-0">
                <AvatarFallback
                  className={cn(
                    "text-xs",
                    dark && "bg-white/8 text-sand-50",
                  )}
                >
                  {initials(b.guestName)}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "flex items-center gap-2 truncate text-[15px] font-medium",
                    dark ? "text-sand-50" : "text-foreground",
                  )}
                >
                  {b.guestName}
                  {b.isVip && (
                    <Crown
                      className={cn(
                        "h-3.5 w-3.5 shrink-0",
                        dark ? "text-gilt-light" : "text-gilt-dark",
                      )}
                    />
                  )}
                  {imminent && (
                    <span className="relative inline-flex h-2 w-2">
                      <span
                        className={cn(
                          "absolute inline-flex h-full w-full animate-ping rounded-full opacity-70",
                          dark ? "bg-emerald-400" : "bg-status-confirmed",
                        )}
                      />
                      <span
                        className={cn(
                          "relative inline-flex h-2 w-2 rounded-full",
                          dark ? "bg-emerald-400" : "bg-status-confirmed",
                        )}
                      />
                    </span>
                  )}
                </p>
                <p
                  className={cn(
                    "mt-0.5 truncate text-[12.5px]",
                    dark ? "text-sand-50/55" : "text-tertiary",
                  )}
                >
                  {b.tableLabel ? `Tavolo ${b.tableLabel}` : "Tavolo da assegnare"}
                  {b.notes ? ` · ${b.notes}` : ""}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-sm text-numeric font-medium",
                    dark
                      ? "border-white/15 text-sand-50/85"
                      : "border-border text-foreground",
                  )}
                >
                  <Users
                    className={cn(
                      "h-3.5 w-3.5",
                      dark ? "text-sand-50/45" : "text-tertiary",
                    )}
                  />
                  {b.partySize}
                </span>
                <StatusPill status={b.status} />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

const KIND_META: Record<
  PredictiveSlot["kind"],
  { label: string; icon: typeof Sparkles; tone: string; toneDark: string }
> = {
  peak: {
    label: "Peak attesa",
    icon: TrendingUp,
    tone: "text-gilt-dark bg-gilt/15",
    toneDark: "text-gilt-light bg-gilt/15",
  },
  free: {
    label: "Slot libero",
    icon: Utensils,
    tone: "text-status-confirmed bg-status-confirmed-soft",
    toneDark: "text-emerald-300 bg-emerald-400/15",
  },
  ai: {
    label: "Suggerimento AI",
    icon: Sparkles,
    tone: "text-status-vip bg-status-vip-soft",
    toneDark: "text-sky-300 bg-sky-400/15",
  },
  walkin: {
    label: "Walk-in stimato",
    icon: Zap,
    tone: "text-status-pending bg-status-pending-soft",
    toneDark: "text-amber-300 bg-amber-400/15",
  },
};

function PredictiveEmpty({
  slots,
  dark,
}: {
  slots: PredictiveSlot[];
  dark: boolean;
}) {
  if (slots.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-6 py-12 text-center",
          dark
            ? "border-white/12 bg-white/[0.02]"
            : "border-border-strong/50 bg-[hsl(var(--surface-sunken))]/40",
        )}
      >
        <p
          className={cn(
            "text-display text-base font-medium",
            dark ? "text-sand-50" : "text-foreground",
          )}
        >
          Servizio non ancora iniziato
        </p>
        <p
          className={cn(
            "max-w-md text-sm leading-snug",
            dark ? "text-sand-50/55" : "text-secondary",
          )}
        >
          Appena entra una prenotazione (da widget, telefono o walk-in) la vedi
          qui in tempo reale con countdown e azioni rapide.
        </p>
        <Button asChild variant="gold" size="sm">
          <Link href="/bookings/new">Crea la prima prenotazione</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "flex items-center justify-between rounded-xl px-3 py-2",
          dark ? "bg-white/[0.03]" : "bg-[hsl(var(--surface-sunken))]/50",
        )}
      >
        <p
          className={cn(
            "text-[10.5px] font-medium uppercase tracking-[0.18em]",
            dark ? "text-gilt-light" : "text-gilt-dark",
          )}
        >
          Predictive · stima servizio
        </p>
        <p
          className={cn(
            "text-[11px]",
            dark ? "text-sand-50/55" : "text-tertiary",
          )}
        >
          Basato su storico turno
        </p>
      </div>
      <ul className={cn("divide-y", dark ? "divide-white/8" : "divide-border")}>
        {slots.map((s, i) => {
          const meta = KIND_META[s.kind];
          const Icon = meta.icon;
          return (
            <li
              key={i}
              className="-mx-1 flex items-center gap-4 px-1 py-3"
            >
              <div className="w-20 shrink-0">
                <p
                  className={cn(
                    "text-display text-numeric text-2xl font-medium leading-none tabular-nums opacity-60",
                    dark ? "text-sand-50" : "text-foreground",
                  )}
                >
                  {s.time}
                </p>
                <p
                  className={cn(
                    "mt-1 text-[10px] font-medium uppercase tracking-[0.14em]",
                    dark ? "text-sand-50/45" : "text-tertiary",
                  )}
                >
                  predictive
                </p>
              </div>
              <div
                className={cn(
                  "h-12 w-px shrink-0",
                  dark ? "bg-white/10" : "bg-border",
                )}
              />
              <span
                className={cn(
                  "grid h-11 w-11 shrink-0 place-items-center rounded-xl",
                  dark ? meta.toneDark : meta.tone,
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-[15px] font-medium",
                    dark ? "text-sand-50" : "text-foreground",
                  )}
                >
                  {s.label}
                </p>
                <p
                  className={cn(
                    "mt-0.5 truncate text-[12.5px]",
                    dark ? "text-sand-50/55" : "text-tertiary",
                  )}
                >
                  {s.hint}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-0.5 text-[10.5px] font-medium",
                  dark ? "bg-white/8 text-sand-50/70" : "bg-secondary text-secondary",
                )}
              >
                {meta.label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
