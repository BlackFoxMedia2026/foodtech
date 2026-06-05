"use client";

import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/utils";
import { useRealtimeNow } from "@/components/providers/realtime-sync";

export type ArrivalRow = {
  id: string;
  startsAt: string;
  partySize: number;
  guestName: string | null;
  tableLabel: string | null;
};

function diffMinutes(targetIso: string, now: Date) {
  const target = new Date(targetIso).getTime();
  return Math.round((target - now.getTime()) / 60_000);
}

function diffLabel(min: number) {
  if (min < -1) return `${-min} min fa`;
  if (min <= 0) return "adesso";
  if (min < 60) return `tra ${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `tra ${h}h` : `tra ${h}h ${m}m`;
}

export function NextArrival({ next }: { next: ArrivalRow | null }) {
  // Driven by the centralised RealtimeSyncProvider — no local interval.
  const now = useRealtimeNow();

  if (!next) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <Clock className="h-4 w-4 text-tertiary" />
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-tertiary">
            Prossimo arrivo
          </p>
          <p className="text-sm text-secondary">Nessuna prenotazione in agenda.</p>
        </div>
      </div>
    );
  }

  const name = next.guestName ?? "Walk-in";
  const min = diffMinutes(next.startsAt, now);
  const imminent = min >= 0 && min <= 15;

  return (
    <Link
      href={`/bookings/${next.id}`}
      className="group flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-border-strong"
    >
      <Avatar className="h-9 w-9">
        <AvatarFallback className="text-[10.5px]">{initials(name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{name}</p>
          {imminent && (
            <span className="relative inline-flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-confirmed opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-status-confirmed" />
            </span>
          )}
        </div>
        <p className="truncate text-[11px] text-tertiary">
          {next.partySize} pers ·{" "}
          {next.tableLabel ? `T${next.tableLabel}` : "tavolo libero"} ·{" "}
          <span className="text-numeric text-foreground">{diffLabel(min)}</span>
        </p>
      </div>
      <ArrowRight className="h-3.5 w-3.5 text-tertiary transition-colors group-hover:text-foreground" />
    </Link>
  );
}
