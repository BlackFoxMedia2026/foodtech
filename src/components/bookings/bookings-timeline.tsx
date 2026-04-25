"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { Booking, Guest, Table } from "@prisma/client";
import { Crown, AlertTriangle } from "lucide-react";
import { cn, formatTime } from "@/lib/utils";

type Row = Booking & { guest: Guest | null; table: Table | null };

const STATUS_TONE: Record<string, string> = {
  CONFIRMED: "bg-emerald-100 text-emerald-800 border-emerald-300",
  PENDING: "bg-amber-100 text-amber-800 border-amber-300",
  ARRIVED: "bg-sky-100 text-sky-800 border-sky-300",
  SEATED: "bg-violet-100 text-violet-800 border-violet-300",
  COMPLETED: "bg-stone-100 text-stone-700 border-stone-300",
  CANCELLED: "bg-rose-50 text-rose-600 border-rose-200 line-through",
  NO_SHOW: "bg-rose-100 text-rose-800 border-rose-300",
};

const PX_PER_MIN = 2;
const ROW_HEIGHT = 56;
const HEADER_WIDTH = 96;

export function BookingsTimeline({
  rows,
  tables,
  day,
  startHour = 11,
  endHour = 24,
}: {
  rows: Row[];
  tables: { id: string; label: string; seats: number }[];
  day: string;
  startHour?: number;
  endHour?: number;
}) {
  const totalMinutes = (endHour - startHour) * 60;
  const totalWidth = totalMinutes * PX_PER_MIN;

  const dayStart = useMemo(() => {
    const [y, m, d] = day.split("-").map(Number);
    return new Date(y, m - 1, d, startHour, 0, 0, 0);
  }, [day, startHour]);

  const byTable = useMemo(() => {
    const map = new Map<string | null, Row[]>();
    for (const r of rows) {
      const key = r.tableId ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return map;
  }, [rows]);

  const unassigned = byTable.get(null) ?? [];

  const hourTicks: number[] = [];
  for (let h = startHour; h <= endHour; h++) {
    hourTicks.push(h);
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <div className="min-w-fit">
        <div
          className="sticky top-0 z-10 flex border-b bg-card text-xs text-muted-foreground"
          style={{ paddingLeft: HEADER_WIDTH }}
        >
          {hourTicks.map((h, i) => (
            <div
              key={h}
              className="border-l text-center"
              style={{ width: i === hourTicks.length - 1 ? 0 : 60 * PX_PER_MIN }}
            >
              <span className="block py-2">{String(h).padStart(2, "0")}:00</span>
            </div>
          ))}
        </div>

        {tables.map((t) => {
          const list = byTable.get(t.id) ?? [];
          return (
            <div key={t.id} className="flex border-b" style={{ height: ROW_HEIGHT }}>
              <div
                className="flex shrink-0 items-center gap-2 border-r bg-secondary/50 px-3 text-sm"
                style={{ width: HEADER_WIDTH }}
              >
                <span className="font-medium">{t.label}</span>
                <span className="text-xs text-muted-foreground">{t.seats}p</span>
              </div>
              <div className="relative" style={{ width: totalWidth }}>
                {hourTicks.map((_, i) => (
                  <div
                    key={i}
                    className="absolute top-0 h-full border-l border-dashed border-border/60"
                    style={{ left: i * 60 * PX_PER_MIN }}
                  />
                ))}
                {list.map((b) => (
                  <BookingPill
                    key={b.id}
                    booking={b}
                    dayStart={dayStart}
                    totalMinutes={totalMinutes}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {unassigned.length > 0 && (
          <div className="flex border-t-2 border-dashed bg-amber-50/40" style={{ height: ROW_HEIGHT }}>
            <div
              className="flex shrink-0 items-center gap-2 border-r bg-amber-50 px-3 text-sm text-amber-800"
              style={{ width: HEADER_WIDTH }}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              <span className="font-medium">Senza tavolo</span>
            </div>
            <div className="relative" style={{ width: totalWidth }}>
              {unassigned.map((b) => (
                <BookingPill key={b.id} booking={b} dayStart={dayStart} totalMinutes={totalMinutes} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BookingPill({
  booking,
  dayStart,
  totalMinutes,
}: {
  booking: Row;
  dayStart: Date;
  totalMinutes: number;
}) {
  const startMs = new Date(booking.startsAt).getTime() - dayStart.getTime();
  const startMin = Math.max(0, Math.round(startMs / 60_000));
  const endMin = Math.min(totalMinutes, startMin + booking.durationMin);
  if (endMin <= 0 || startMin >= totalMinutes) return null;

  const left = startMin * PX_PER_MIN;
  const width = Math.max(40, (endMin - startMin) * PX_PER_MIN - 4);
  const tone = STATUS_TONE[booking.status] ?? "bg-stone-100 text-stone-700 border-stone-300";
  const guestName = booking.guest
    ? [booking.guest.firstName, booking.guest.lastName].filter(Boolean).join(" ")
    : "Ospite";
  const isVip = booking.guest?.loyaltyTier === "VIP" || booking.guest?.loyaltyTier === "AMBASSADOR";

  return (
    <Link
      href={`/bookings/${booking.id}`}
      className={cn(
        "absolute top-1 flex flex-col gap-0.5 overflow-hidden rounded-md border px-2 py-1 text-xs shadow-sm transition hover:shadow-md",
        tone,
      )}
      style={{ left, width, height: ROW_HEIGHT - 8 }}
      title={`${guestName} · ${booking.partySize}p · ${booking.status}`}
    >
      <span className="flex items-center gap-1 font-medium">
        {isVip && <Crown className="h-3 w-3 shrink-0 text-gilt-dark" />}
        <span className="truncate">{guestName}</span>
        <span className="shrink-0 opacity-70">· {booking.partySize}</span>
      </span>
      <span className="text-[10px] opacity-70">
        {formatTime(booking.startsAt)} · {booking.durationMin}m
      </span>
    </Link>
  );
}
