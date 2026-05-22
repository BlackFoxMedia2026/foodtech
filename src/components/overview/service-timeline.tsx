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

export function ServiceTimeline({ rows }: { rows: TimelineRow[] }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

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
          <Button asChild variant="outline" size="sm">
            <Link href="/bookings?walkin=1">Walk-in rapido</Link>
          </Button>
        }
        hint="Tutto ciò che entra in agenda da widget, telefono o app comparirà qui in tempo reale."
      />
    );
  }

  return (
    <ul className="divide-y divide-border">
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
                "-mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-secondary/40",
                overdue && "bg-status-no-show-soft/30",
              )}
            >
              <div className="w-14 shrink-0 text-right">
                <p className="text-display text-numeric text-[15px] font-medium leading-none">
                  {formatTime(b.startsAt)}
                </p>
                <p
                  className={cn(
                    "mt-0.5 text-[10px] text-numeric",
                    overdue
                      ? "text-status-no-show font-medium"
                      : imminent
                        ? "text-status-confirmed font-medium"
                        : "text-tertiary",
                  )}
                >
                  {diffLabel(min)}
                </p>
              </div>
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-[10.5px]">
                  {initials(b.guestName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                  {b.guestName}
                  {b.isVip && <Crown className="h-3 w-3 shrink-0 text-gilt-dark" />}
                  {imminent && (
                    <span className="relative inline-flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-confirmed opacity-60" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-status-confirmed" />
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-tertiary">
                  {b.tableLabel ? `Tavolo ${b.tableLabel}` : "Tavolo da assegnare"}
                  {b.notes ? ` · ${b.notes}` : ""}
                </p>
              </div>
              <span className="hidden items-center gap-1 text-xs text-numeric text-secondary sm:inline-flex">
                <Users className="h-3.5 w-3.5 text-tertiary" />
                {b.partySize}
              </span>
              <StatusPill status={b.status} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
