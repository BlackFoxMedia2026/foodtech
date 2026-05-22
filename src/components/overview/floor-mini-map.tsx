import Link from "next/link";
import { ArrowRight, LayoutPanelLeft } from "lucide-react";
import type { TableShape } from "@prisma/client";
import {
  TABLE_SHAPE_SIZE,
  TABLE_LIVE_TONE,
  type TableLiveStatus,
} from "@/lib/floor";
import { cn } from "@/lib/utils";

type MiniTable = {
  id: string;
  label: string;
  shape: TableShape;
  posX: number;
  posY: number;
  rotation: number;
  status: TableLiveStatus;
};

export function FloorMiniMap({
  tables,
  width,
  height,
  scale = 0.42,
}: {
  tables: MiniTable[];
  width: number;
  height: number;
  scale?: number;
}) {
  const counts = tables.reduce(
    (acc, t) => {
      acc[t.status] = (acc[t.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<TableLiveStatus, number>,
  );

  return (
    <Link
      href="/floor?mode=live"
      className="group block rounded-xl border border-border bg-card p-4 transition-colors hover:border-border-strong"
    >
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LayoutPanelLeft className="h-4 w-4 text-tertiary" />
          <p className="text-[13px] font-medium">Mappa sala live</p>
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-tertiary transition-colors group-hover:text-foreground">
          Apri <ArrowRight className="h-3 w-3" />
        </span>
      </header>

      <div
        className="relative overflow-hidden rounded-lg bg-[hsl(var(--surface-sunken))]/40"
        style={{
          width: width * scale,
          height: height * scale,
          maxWidth: "100%",
        }}
      >
        {tables.map((t) => {
          const size = TABLE_SHAPE_SIZE[t.shape];
          const tone = TABLE_LIVE_TONE[t.status];
          const isRound = t.shape === "ROUND";
          return (
            <div
              key={t.id}
              className={cn(
                "absolute border",
                tone.bg,
                tone.border,
                isRound ? "rounded-full" : "rounded-sm",
              )}
              style={{
                left: t.posX * scale,
                top: t.posY * scale,
                width: size.w * scale,
                height: size.h * scale,
                transform: `rotate(${t.rotation}deg)`,
              }}
            />
          );
        })}
        {tables.length === 0 && (
          <div className="grid h-full place-items-center text-[10.5px] text-tertiary">
            Nessun tavolo configurato
          </div>
        )}
      </div>

      <footer className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px]">
        <MiniLegend status="seated" count={counts.seated ?? 0} />
        <MiniLegend status="arrived" count={counts.arrived ?? 0} />
        <MiniLegend status="reserved" count={counts.reserved ?? 0} />
        <MiniLegend status="blocked" count={counts.blocked ?? 0} />
        <MiniLegend status="free" count={counts.free ?? 0} />
      </footer>
    </Link>
  );
}

function MiniLegend({ status, count }: { status: TableLiveStatus; count: number }) {
  const tone = TABLE_LIVE_TONE[status];
  return (
    <span className="inline-flex items-center gap-1 text-tertiary">
      <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} />
      <span className="font-medium text-foreground text-numeric">{count}</span>
      {tone.label.toLowerCase()}
    </span>
  );
}
