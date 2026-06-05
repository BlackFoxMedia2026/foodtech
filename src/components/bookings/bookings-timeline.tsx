"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import type { Booking, Guest, Table } from "@prisma/client";
import { Crown, AlertTriangle } from "lucide-react";
import { cn, formatTime } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

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
const SNAP_MIN = 15;
const PX_PER_SNAP = SNAP_MIN * PX_PER_MIN; // 30px
const LONG_PRESS_MS = 400;

const DRAG_LOCKED_STATUSES = new Set(["COMPLETED", "CANCELLED", "NO_SHOW"]);

type DragPayload = {
  id: string;
  originalTableId: string | null;
  originalStartsAt: string;
  durationMin: number;
  status: string;
};

type HoverInfo = {
  tableId: string | null;
  startMin: number; // minutes from startHour
};

type OptimisticPatch = {
  tableId: string | null;
  startsAt: string;
};

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
  const router = useRouter();
  const { toast } = useToast();

  const totalMinutes = (endHour - startHour) * 60;
  const totalWidth = totalMinutes * PX_PER_MIN;

  const dayStart = useMemo(() => {
    const [y, m, d] = day.split("-").map(Number);
    return new Date(y, m - 1, d, startHour, 0, 0, 0);
  }, [day, startHour]);

  // Optimistic overrides indexed by booking id. Cleared when router.refresh()
  // restituisce dati aggiornati (re-render con rows nuovi).
  const [overrides, setOverrides] = useState<Map<string, OptimisticPatch>>(new Map());
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const dragPayload = useRef<DragPayload | null>(null);

  // Applica override ai rows prima di indicizzarli per tavolo.
  const effectiveRows = useMemo(() => {
    if (overrides.size === 0) return rows;
    return rows.map((r) => {
      const o = overrides.get(r.id);
      if (!o) return r;
      const newTable =
        o.tableId === null
          ? null
          : o.tableId === r.tableId
            ? r.table
            : (tables.find((t) => t.id === o.tableId)
                ? ({
                    ...(r.table ?? {}),
                    id: o.tableId,
                    label: tables.find((t) => t.id === o.tableId)!.label,
                  } as unknown as Table)
                : r.table);
      return {
        ...r,
        tableId: o.tableId,
        startsAt: new Date(o.startsAt) as unknown as Booking["startsAt"],
        table: newTable,
      };
    });
  }, [rows, overrides, tables]);

  const byTable = useMemo(() => {
    const map = new Map<string | null, Row[]>();
    for (const r of effectiveRows) {
      const key = r.tableId ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return map;
  }, [effectiveRows]);

  const unassigned = byTable.get(null) ?? [];

  const hourTicks: number[] = [];
  for (let h = startHour; h <= endHour; h++) {
    hourTicks.push(h);
  }

  /** Calcola minuti snapped (multipli di 15) dalla X del drop event. */
  const computeSnapMinutes = useCallback(
    (clientX: number, rowEl: HTMLElement) => {
      const rect = rowEl.getBoundingClientRect();
      const deltaX = clientX - rect.left;
      const snapped = Math.round(deltaX / PX_PER_SNAP) * SNAP_MIN;
      // Clamp dentro la finestra: il pill ha durata, quindi limita start
      // così che end <= totalMinutes.
      const dur = dragPayload.current?.durationMin ?? 60;
      const maxStart = totalMinutes - dur;
      return Math.max(0, Math.min(maxStart, snapped));
    },
    [totalMinutes],
  );

  const reasonMessage = useCallback((raw: string | undefined) => {
    if (!raw) return "Salvataggio fallito.";
    if (raw.startsWith("table_overlap")) return "Tavolo già occupato in quella fascia.";
    if (raw.startsWith("table_not_combinable")) return "Tavolo non combinabile.";
    return "Salvataggio fallito.";
  }, []);

  const performMove = useCallback(
    async (payload: DragPayload, newTableId: string | null, newStartMin: number) => {
      if (!newTableId) {
        // Non supportiamo drop sulla riga "Senza tavolo" — richiederebbe un
        // unset esplicito del tableId che l'API non garantisce. Skip silently.
        return;
      }
      const newStartsAt = new Date(dayStart.getTime() + newStartMin * 60_000);
      const newIso = newStartsAt.toISOString();

      // Optimistic: applica override.
      setOverrides((prev) => {
        const next = new Map(prev);
        next.set(payload.id, { tableId: newTableId, startsAt: newIso });
        return next;
      });

      try {
        const res = await fetch(`/api/bookings/${payload.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tableId: newTableId, startsAt: newIso }),
        });
        if (!res.ok) {
          let reason: string | undefined;
          try {
            const data = (await res.json()) as { error?: string };
            reason = data.error;
          } catch {
            // ignore
          }
          throw new Error(reason ?? "Salvataggio fallito.");
        }
        const targetLabel = tables.find((t) => t.id === newTableId)?.label ?? "?";
        const hh = String(Math.floor(newStartMin / 60) + startHour).padStart(2, "0");
        const mm = String(newStartMin % 60).padStart(2, "0");
        if (payload.status === "SEATED") {
          toast.info(
            `Spostato a T${targetLabel} ore ${hh}:${mm}`,
            "Spostamento ospite già seduto: assicurati di avvisarlo.",
          );
        } else {
          toast.success(`Spostato a T${targetLabel} ore ${hh}:${mm}`);
        }
        router.refresh();
        // Tieni l'override finché il refresh non arriva: il prossimo render
        // di `rows` lo renderà ridondante. Pulisci dopo un breve delay per
        // evitare flash visivi.
        setTimeout(() => {
          setOverrides((prev) => {
            const next = new Map(prev);
            next.delete(payload.id);
            return next;
          });
        }, 600);
      } catch (err) {
        // Revert override.
        setOverrides((prev) => {
          const next = new Map(prev);
          next.delete(payload.id);
          return next;
        });
        const msg = err instanceof Error ? err.message : undefined;
        toast.error("Spostamento non riuscito", reasonMessage(msg));
      }
    },
    [dayStart, startHour, router, tables, toast, reasonMessage],
  );

  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLElement>, payload: DragPayload) => {
      dragPayload.current = payload;
      setDraggingId(payload.id);
      try {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", payload.id);
      } catch {
        // Some browsers throw if effectAllowed is set during pointer-based drag.
      }
    },
    [],
  );

  const handleDragEnd = useCallback(() => {
    dragPayload.current = null;
    setDraggingId(null);
    setHover(null);
  }, []);

  const handleRowDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>, tableId: string | null) => {
      if (!dragPayload.current) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const snap = computeSnapMinutes(e.clientX, e.currentTarget);
      setHover((prev) =>
        prev && prev.tableId === tableId && prev.startMin === snap
          ? prev
          : { tableId, startMin: snap },
      );
    },
    [computeSnapMinutes],
  );

  const handleRowDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>, tableId: string | null) => {
      const payload = dragPayload.current;
      if (!payload) return;
      e.preventDefault();
      const snap = computeSnapMinutes(e.clientX, e.currentTarget);
      dragPayload.current = null;
      setDraggingId(null);
      setHover(null);
      void performMove(payload, tableId, snap);
    },
    [computeSnapMinutes, performMove],
  );

  // --- Touch / pointer-based drag (long-press) -----------------------------
  // HTML5 native drag non parte da touch su iOS senza polyfill. Implementiamo
  // un mini gesture: long-press 400ms su pill → enter "drag mode" controllato
  // via pointer events. Coesiste con il drag desktop tradizionale.
  const touchSession = useRef<{
    payload: DragPayload;
    pointerId: number;
    timer: ReturnType<typeof setTimeout> | null;
    armed: boolean;
  } | null>(null);

  const pointerRowOver = useCallback(
    (clientX: number, clientY: number) => {
      // Trova la riga sotto al puntatore.
      const el = document.elementFromPoint(clientX, clientY);
      if (!el) return null;
      const rowEl = (el as HTMLElement).closest<HTMLElement>("[data-timeline-row]");
      if (!rowEl) return null;
      const tableId = rowEl.dataset.tableId ?? null;
      const snap = computeSnapMinutes(clientX, rowEl);
      return { tableId: tableId || null, startMin: snap };
    },
    [computeSnapMinutes],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>, payload: DragPayload) => {
      // Solo touch / pen: il mouse usa il path HTML5 native.
      if (e.pointerType === "mouse") return;
      const target = e.currentTarget;
      const session = {
        payload,
        pointerId: e.pointerId,
        armed: false,
        timer: setTimeout(() => {
          if (!touchSession.current) return;
          touchSession.current.armed = true;
          dragPayload.current = payload;
          setDraggingId(payload.id);
          try {
            target.setPointerCapture(e.pointerId);
          } catch {
            // ignore
          }
        }, LONG_PRESS_MS),
      };
      touchSession.current = session;
    },
    [],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const sess = touchSession.current;
      if (!sess || sess.pointerId !== e.pointerId) return;
      if (!sess.armed) return;
      e.preventDefault();
      const info = pointerRowOver(e.clientX, e.clientY);
      setHover(info);
    },
    [pointerRowOver],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const sess = touchSession.current;
      if (!sess || sess.pointerId !== e.pointerId) {
        touchSession.current = null;
        return;
      }
      if (sess.timer) clearTimeout(sess.timer);
      if (sess.armed) {
        const info = pointerRowOver(e.clientX, e.clientY);
        const payload = sess.payload;
        touchSession.current = null;
        dragPayload.current = null;
        setDraggingId(null);
        setHover(null);
        if (info) void performMove(payload, info.tableId, info.startMin);
      } else {
        touchSession.current = null;
      }
    },
    [pointerRowOver, performMove],
  );

  const handlePointerCancel = useCallback(() => {
    const sess = touchSession.current;
    if (sess?.timer) clearTimeout(sess.timer);
    touchSession.current = null;
    dragPayload.current = null;
    setDraggingId(null);
    setHover(null);
  }, []);

  // -------------------------------------------------------------------------

  const renderRow = (
    tableId: string | null,
    tableLabel: string,
    seats: number | null,
    list: Row[],
    isUnassigned = false,
  ) => {
    const isHoverRow = !!draggingId && hover?.tableId === tableId;
    const hh = hover ? String(Math.floor(hover.startMin / 60) + startHour).padStart(2, "0") : "";
    const mm = hover ? String(hover.startMin % 60).padStart(2, "0") : "";
    return (
      <div
        key={tableId ?? "__unassigned__"}
        className={cn(
          "flex border-b",
          isUnassigned && "border-t-2 border-dashed bg-amber-50/40",
        )}
        style={{ height: ROW_HEIGHT }}
      >
        <div
          className={cn(
            "flex shrink-0 items-center gap-2 border-r px-3 text-sm",
            isUnassigned ? "bg-amber-50 text-amber-800" : "bg-secondary/50",
          )}
          style={{ width: HEADER_WIDTH }}
        >
          {isUnassigned && <AlertTriangle className="h-3.5 w-3.5" />}
          <span className="font-medium">{tableLabel}</span>
          {seats !== null && <span className="text-xs text-muted-foreground">{seats}p</span>}
        </div>
        <div
          className={cn(
            "relative",
            isHoverRow &&
              (isUnassigned
                ? "outline outline-2 outline-dashed outline-status-no-show"
                : "outline outline-2 outline-dashed outline-gilt"),
          )}
          style={{ width: totalWidth }}
          data-timeline-row
          data-table-id={tableId ?? ""}
          onDragOver={(e) => handleRowDragOver(e, tableId)}
          onDragLeave={(e) => {
            // Solo se davvero usciamo dalla row (relatedTarget fuori).
            if (
              e.relatedTarget instanceof Node &&
              e.currentTarget.contains(e.relatedTarget)
            ) {
              return;
            }
            setHover((prev) => (prev?.tableId === tableId ? null : prev));
          }}
          onDrop={(e) => handleRowDrop(e, tableId)}
        >
          {hourTicks.map((_, i) => (
            <div
              key={i}
              className="absolute top-0 h-full border-l border-dashed border-border/60"
              style={{ left: i * 60 * PX_PER_MIN }}
            />
          ))}
          {isHoverRow && !isUnassigned && (
            <div
              className="pointer-events-none absolute top-0 h-full w-[2px] bg-gilt/70"
              style={{ left: hover!.startMin * PX_PER_MIN }}
            >
              <span className="absolute -top-5 left-1 whitespace-nowrap rounded bg-gilt/90 px-1.5 py-0.5 text-[10px] font-medium text-white">
                T{tableLabel} · {hh}:{mm}
              </span>
            </div>
          )}
          {list.map((b) => (
            <BookingPill
              key={b.id}
              booking={b}
              dayStart={dayStart}
              totalMinutes={totalMinutes}
              isDragging={draggingId === b.id}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
            />
          ))}
        </div>
      </div>
    );
  };

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

        {tables.map((t) =>
          renderRow(t.id, t.label, t.seats, byTable.get(t.id) ?? []),
        )}

        {unassigned.length > 0 && renderRow(null, "Senza tavolo", null, unassigned, true)}
      </div>
    </div>
  );
}

function BookingPill({
  booking,
  dayStart,
  totalMinutes,
  isDragging,
  onDragStart,
  onDragEnd,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: {
  booking: Row;
  dayStart: Date;
  totalMinutes: number;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent<HTMLElement>, payload: DragPayload) => void;
  onDragEnd: () => void;
  onPointerDown: (e: React.PointerEvent<HTMLElement>, payload: DragPayload) => void;
  onPointerMove: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerCancel: () => void;
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
  const isLocked = DRAG_LOCKED_STATUSES.has(booking.status);

  const payload: DragPayload = {
    id: booking.id,
    originalTableId: booking.tableId ?? null,
    originalStartsAt:
      booking.startsAt instanceof Date
        ? booking.startsAt.toISOString()
        : new Date(booking.startsAt).toISOString(),
    durationMin: booking.durationMin,
    status: booking.status,
  };

  const commonStyle: React.CSSProperties = {
    left,
    width,
    height: ROW_HEIGHT - 8,
    touchAction: isLocked ? "auto" : "none",
  };
  const commonClass = cn(
    "absolute top-1 flex flex-col gap-0.5 overflow-hidden rounded-md border px-2 py-1 text-xs shadow-sm transition hover:shadow-md",
    tone,
    isLocked ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing",
    isDragging && "opacity-50 ring-2 ring-gilt cursor-grabbing",
  );
  const titleText = `${guestName} · ${booking.partySize}p · ${booking.status}`;

  if (isLocked) {
    return (
      <Link
        href={`/bookings/${booking.id}`}
        className={commonClass}
        style={commonStyle}
        title={titleText}
      >
        <PillBody guestName={guestName} isVip={isVip} booking={booking} />
      </Link>
    );
  }

  return (
    <Link
      href={`/bookings/${booking.id}`}
      draggable
      onDragStart={(e) => onDragStart(e, payload)}
      onDragEnd={onDragEnd}
      onPointerDown={(e) => onPointerDown(e, payload)}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onClick={(e) => {
        // Se siamo a metà di un drag (touch/pointer), evita la navigazione.
        if (isDragging) e.preventDefault();
      }}
      className={commonClass}
      style={commonStyle}
      title={titleText}
    >
      <PillBody guestName={guestName} isVip={isVip} booking={booking} />
    </Link>
  );
}

function PillBody({
  guestName,
  isVip,
  booking,
}: {
  guestName: string;
  isVip: boolean;
  booking: Row;
}) {
  return (
    <>
      <span className="flex items-center gap-1 font-medium">
        {isVip && <Crown className="h-3 w-3 shrink-0 text-gilt-dark" />}
        <span className="truncate">{guestName}</span>
        <span className="shrink-0 opacity-70">· {booking.partySize}</span>
      </span>
      <span className="text-[10px] opacity-70">
        {formatTime(booking.startsAt)} · {booking.durationMin}m
      </span>
    </>
  );
}
