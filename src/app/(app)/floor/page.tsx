import Link from "next/link";
import { db } from "@/lib/db";
import { getActiveVenue } from "@/lib/tenant";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { FloorCanvas } from "@/components/floor/floor-canvas";
import { FloorLive } from "@/components/floor/floor-live";
import { TableBlocksCard } from "@/components/floor/table-blocks-card";
import { listActiveBlocks } from "@/server/blocks";
import { startOfDay, endOfDay } from "@/lib/utils";
import type { TableLiveStatus } from "@/lib/floor";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Mode = "live" | "editor" | "blocks";

export default async function FloorPage({
  searchParams,
}: {
  searchParams: { mode?: string };
}) {
  const ctx = await getActiveVenue();
  const mode: Mode =
    searchParams.mode === "editor"
      ? "editor"
      : searchParams.mode === "blocks"
        ? "blocks"
        : "live";

  const room = await db.room.findFirst({ where: { venueId: ctx.venueId } });

  const now = new Date();
  const [tables, decor, blocks, activeBookings] = await Promise.all([
    db.table.findMany({
      where: { venueId: ctx.venueId },
      orderBy: { label: "asc" },
    }),
    db.floorDecor.findMany({
      where: { venueId: ctx.venueId },
      orderBy: { createdAt: "asc" },
    }),
    listActiveBlocks(ctx.venueId),
    db.booking.findMany({
      where: {
        venueId: ctx.venueId,
        tableId: { not: null },
        startsAt: { gte: startOfDay(now), lte: endOfDay(now) },
        status: { in: ["CONFIRMED", "PENDING", "ARRIVED", "SEATED"] },
      },
      include: {
        guest: { select: { firstName: true, lastName: true } },
      },
      orderBy: { startsAt: "asc" },
    }),
  ]);

  const totalSeats = tables.reduce((s, t) => s + t.seats, 0);

  // Map status per table from active bookings (priorita': seated > arrived > reserved).
  // Per le booking con tavoli combinati (es. T5+T6+T7 per gruppo da 18) mappiamo
  // tutti i tavoli del gruppo alla stessa booking primaria: il click su uno
  // qualsiasi porta alla stessa scheda, e visivamente avranno lo stesso bordo.
  const priority: Record<string, number> = {
    SEATED: 4,
    ARRIVED: 3,
    CONFIRMED: 2,
    PENDING: 1,
  };
  const bookingByTable = new Map<string, (typeof activeBookings)[number]>();
  const combinedGroupByTable = new Map<string, string>(); // tableId → groupKey (= booking.id)
  for (const b of activeBookings) {
    if (!b.tableId) continue;
    const tableIds = [b.tableId, ...(b.combinedTableIds ?? [])];
    for (const tid of tableIds) {
      const existing = bookingByTable.get(tid);
      if (!existing || priority[b.status] > priority[existing.status]) {
        bookingByTable.set(tid, b);
      }
    }
    if ((b.combinedTableIds ?? []).length > 0) {
      for (const tid of tableIds) combinedGroupByTable.set(tid, b.id);
    }
  }

  const blockedTableIds = new Set(
    blocks
      .filter((b) => new Date(b.startsAt) <= now && new Date(b.endsAt) >= now)
      .map((b) => b.tableId),
  );

  const liveTables = tables.map((t) => {
    const b = bookingByTable.get(t.id);
    let status: TableLiveStatus = "free";
    let guestName: string | null = null;
    let bookingId: string | null = null;
    let startsAt: string | null = null;
    let partySize: number | null = null;

    if (blockedTableIds.has(t.id)) {
      status = "blocked";
    } else if (b) {
      if (b.status === "SEATED") status = "seated";
      else if (b.status === "ARRIVED") status = "arrived";
      else status = "reserved";
      guestName = b.guest
        ? `${b.guest.firstName} ${b.guest.lastName ?? ""}`.trim()
        : "Walk-in";
      bookingId = b.id;
      startsAt = b.startsAt.toISOString();
      partySize = b.partySize;
    }

    return {
      id: t.id,
      label: t.label,
      seats: t.seats,
      shape: t.shape,
      posX: t.posX,
      posY: t.posY,
      rotation: t.rotation,
      status,
      guestName,
      bookingId,
      startsAt,
      partySize,
      combinedGroup: combinedGroupByTable.get(t.id) ?? null,
    };
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-tertiary">Sala</p>
          <h1 className="text-display mt-1 text-[32px] font-medium leading-tight tracking-tight">
            {room?.name ?? "Mappa sala"}
          </h1>
          <p className="mt-1 text-sm text-secondary">
            <span className="text-numeric">{tables.length}</span> tavoli ·{" "}
            <span className="text-numeric">{totalSeats}</span> posti ·{" "}
            <span className="text-numeric">{decor.length}</span> arredi
          </p>
        </div>

        <div className="inline-flex items-center rounded-lg border border-border bg-card p-0.5 text-xs">
          <ModeTab href="/floor?mode=live" active={mode === "live"}>
            Live
          </ModeTab>
          <ModeTab href="/floor?mode=editor" active={mode === "editor"}>
            Editor
          </ModeTab>
          <ModeTab href="/floor?mode=blocks" active={mode === "blocks"}>
            Blocchi
          </ModeTab>
        </div>
      </header>

      {mode === "live" && (
        <Panel>
          <PanelHeader
            title="Stato sala in tempo reale"
            description="Verde = al tavolo · Giallo = prenotato · Rosso = bloccato · Grigio = libero"
          />
          <PanelBody>
            <FloorLive
              tables={liveTables}
              width={room?.width ?? 1200}
              height={room?.height ?? 760}
            />
          </PanelBody>
        </Panel>
      )}

      {mode === "editor" && (
        <Panel>
          <PanelHeader
            title="Editor visuale"
            description="Trascina, ridimensiona, ruota. Aggiungi tavoli e arredi dalla palette. Le modifiche restano locali finché non premi Salva sala."
          />
          <PanelBody>
            <FloorCanvas
              initialTables={tables}
              initialDecor={decor}
              width={room?.width ?? 1200}
              height={room?.height ?? 760}
            />
          </PanelBody>
        </Panel>
      )}

      {mode === "blocks" && (
        <TableBlocksCard
          tables={tables.map((t) => ({ id: t.id, label: t.label, seats: t.seats }))}
          initial={blocks.map((b) => ({
            id: b.id,
            tableId: b.tableId,
            tableLabel: b.table.label,
            startsAt: b.startsAt.toISOString(),
            endsAt: b.endsAt.toISOString(),
            reason: b.reason,
          }))}
        />
      )}
    </div>
  );
}

function ModeTab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-md px-3 py-1.5 font-medium transition-colors",
        active ? "bg-secondary text-foreground" : "text-secondary hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
