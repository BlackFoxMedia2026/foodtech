"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { TableShape } from "@prisma/client";
import {
  TABLE_SHAPE_SIZE,
  TABLE_LIVE_TONE,
  type TableLiveStatus,
} from "@/lib/floor";
import { cn } from "@/lib/utils";

type LiveTable = {
  id: string;
  label: string;
  seats: number;
  shape: TableShape;
  posX: number;
  posY: number;
  rotation: number;
  status: TableLiveStatus;
  guestName: string | null;
  bookingId: string | null;
  startsAt: string | null;
  partySize: number | null;
};

export function FloorLive({
  tables,
  width,
  height,
}: {
  tables: LiveTable[];
  width: number;
  height: number;
}) {
  const counts = tables.reduce(
    (acc, t) => {
      acc[t.status] = (acc[t.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<TableLiveStatus, number>,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <LegendChip status="free" count={counts.free ?? 0} />
        <LegendChip status="reserved" count={counts.reserved ?? 0} />
        <LegendChip status="arrived" count={counts.arrived ?? 0} />
        <LegendChip status="seated" count={counts.seated ?? 0} />
        <LegendChip status="blocked" count={counts.blocked ?? 0} />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-[hsl(var(--surface-sunken))]/40">
        <div
          className="relative mx-auto"
          style={{ width, height, maxWidth: "100%" }}
        >
          {tables.map((t) => (
            <LiveTableTile key={t.id} table={t} />
          ))}
          {tables.length === 0 && (
            <div className="grid h-full place-items-center text-sm text-tertiary">
              Nessun tavolo configurato. Vai in Editor per crearli.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LegendChip({ status, count }: { status: TableLiveStatus; count: number }) {
  const tone = TABLE_LIVE_TONE[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1">
      <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} />
      <span className="font-medium">{tone.label}</span>
      <span className="text-numeric text-tertiary">{count}</span>
    </span>
  );
}

function LiveTableTile({ table }: { table: LiveTable }) {
  const size = TABLE_SHAPE_SIZE[table.shape];
  const tone = TABLE_LIVE_TONE[table.status];
  const isRound = table.shape === "ROUND";
  const [pulse, setPulse] = useState(false);

  // Subtle pulse on arrived/seated for "alive" feel
  useEffect(() => {
    if (table.status === "arrived" || table.status === "seated") {
      const id = setTimeout(() => setPulse(true), 50);
      return () => clearTimeout(id);
    }
  }, [table.status]);

  const content = (
    <div
      className={cn(
        "absolute flex flex-col items-center justify-center gap-0.5 border px-2 py-1 text-center transition-colors",
        tone.bg,
        tone.border,
        tone.text,
        isRound ? "rounded-full" : "rounded-lg",
      )}
      style={{
        left: table.posX,
        top: table.posY,
        width: size.w,
        height: size.h,
        transform: `rotate(${table.rotation}deg)`,
      }}
    >
      <span className="flex items-center gap-1">
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            tone.dot,
            pulse && "animate-pulse",
          )}
        />
        <span className="text-display text-numeric text-[13px] font-medium leading-none">
          {table.label}
        </span>
      </span>
      <span className="text-[10px] text-tertiary text-numeric">
        {table.partySize ?? table.seats}p
      </span>
      {table.guestName && (
        <span className="max-w-[90%] truncate text-[10px] font-medium">
          {table.guestName}
        </span>
      )}
    </div>
  );

  if (table.bookingId) {
    return (
      <Link
        href={`/bookings/${table.bookingId}`}
        aria-label={`Tavolo ${table.label} · ${tone.label}`}
        className="block"
      >
        {content}
      </Link>
    );
  }
  return content;
}
