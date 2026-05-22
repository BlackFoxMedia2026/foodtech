"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Crown, Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusPill, type BookingStatusKey } from "@/components/ui/status-pill";
import { EmptyStateRich } from "@/components/ui/empty-state-rich";
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
  variant = "light",
}: {
  rows: TimelineRow[];
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
      <EmptyStateRich
        title="Nessuna prenotazione oggi"
        description="Puoi crearne una manualmente, aprire il widget pubblico o lasciare entrare un walk-in dalla sala live."
        primary={
          <Button asChild variant="gold" size="sm">
            <Link href="/bookings/new">Nuova prenotazione</Link>
          </Button>
        }
        secondary={
          <Button asChild variant={dark ? "outline" : "outline"} size="sm">
            <Link href="/bookings?walkin=1">Walk-in rapido</Link>
          </Button>
        }
        hint="Tutto ciò che entra in agenda da widget, telefono o app comparirà qui in tempo reale."
        className={dark ? "border-white/10 bg-white/[0.02] text-sand-50" : ""}
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
                "flex items-center gap-4 px-1 py-3.5 transition-colors -mx-1 rounded-md",
                dark
                  ? "hover:bg-white/[0.04]"
                  : "hover:bg-secondary/40",
                overdue && (dark ? "bg-rose-500/10" : "bg-status-no-show-soft/30"),
              )}
            >
              {/* Time column - LARGER */}
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

              {/* Vertical separator line */}
              <div
                className={cn(
                  "h-12 w-px shrink-0",
                  dark ? "bg-white/10" : "bg-border",
                )}
              />

              {/* Avatar - LARGER */}
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

              {/* Main info - LARGER text */}
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
                          "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
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

              {/* Party size + status */}
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
                    className={cn("h-3.5 w-3.5", dark ? "text-sand-50/45" : "text-tertiary")}
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
