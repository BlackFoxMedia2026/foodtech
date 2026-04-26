"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Crown } from "lucide-react";
import { cn, formatTime } from "@/lib/utils";

type Booking = {
  id: string;
  startsAt: string;
  partySize: number;
  status: string;
  occasion: string | null;
  guest: {
    firstName: string;
    lastName: string | null;
    loyaltyTier: "NEW" | "REGULAR" | "VIP" | "AMBASSADOR";
  } | null;
};

type DayCell = { iso: string; label: string; sub: string; bookings: Booking[] };

const STATUS_TONE: Record<string, string> = {
  CONFIRMED: "bg-emerald-50 border-emerald-200 text-emerald-800",
  PENDING: "bg-amber-50 border-amber-200 text-amber-800",
  ARRIVED: "bg-sky-50 border-sky-200 text-sky-800",
  SEATED: "bg-violet-50 border-violet-200 text-violet-800",
  COMPLETED: "bg-stone-50 border-stone-200 text-stone-700",
  CANCELLED: "bg-rose-50 border-rose-200 text-rose-700 line-through",
  NO_SHOW: "bg-rose-100 border-rose-300 text-rose-900",
};

export function BookingsWeek({ bookings, weekStart }: { bookings: Booking[]; weekStart: string }) {
  const cells = useMemo<DayCell[]>(() => {
    const start = new Date(`${weekStart}T00:00:00`);
    const out: DayCell[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      out.push({
        iso,
        label: d.toLocaleDateString("it-IT", { weekday: "short" }),
        sub: d.toLocaleDateString("it-IT", { day: "2-digit", month: "short" }),
        bookings: bookings.filter((b) => b.startsAt.slice(0, 10) === iso).sort((a, b) =>
          a.startsAt < b.startsAt ? -1 : 1,
        ),
      });
    }
    return out;
  }, [bookings, weekStart]);

  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
      {cells.map((c) => {
        const covers = c.bookings
          .filter((b) => b.status !== "CANCELLED")
          .reduce((s, b) => s + b.partySize, 0);
        return (
          <Link
            key={c.iso}
            href={`/bookings?day=${c.iso}&view=list`}
            className="flex min-h-[200px] flex-col rounded-lg border bg-card p-3 transition hover:border-gilt/50 hover:shadow-md"
          >
            <div className="mb-2 flex items-baseline justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{c.label}</p>
                <p className="text-display text-base">{c.sub}</p>
              </div>
              <div className="text-right">
                <p className="text-display text-lg">{covers}</p>
                <p className="text-[10px] text-muted-foreground">coperti</p>
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-1 overflow-y-auto pr-1">
              {c.bookings.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground/60">—</p>
              ) : (
                c.bookings.slice(0, 8).map((b) => {
                  const tone = STATUS_TONE[b.status] ?? "bg-secondary border-border";
                  const name = b.guest
                    ? [b.guest.firstName, b.guest.lastName].filter(Boolean).join(" ")
                    : "Walk-in";
                  const isVip = b.guest?.loyaltyTier === "VIP" || b.guest?.loyaltyTier === "AMBASSADOR";
                  return (
                    <div
                      key={b.id}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded border px-1.5 py-1 text-[11px]",
                        tone,
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-1">
                        <span className="font-medium">{formatTime(b.startsAt)}</span>
                        {isVip && <Crown className="h-2.5 w-2.5" />}
                        <span className="truncate">{name}</span>
                      </span>
                      <span className="shrink-0">·{b.partySize}</span>
                    </div>
                  );
                })
              )}
              {c.bookings.length > 8 && (
                <p className="text-center text-[10px] text-muted-foreground">
                  +{c.bookings.length - 8} altre
                </p>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
