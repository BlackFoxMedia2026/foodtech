import { db } from "@/lib/db";
import { getActiveVenue } from "@/lib/tenant";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FloorCanvas } from "@/components/floor/floor-canvas";
import { TableBlocksCard } from "@/components/floor/table-blocks-card";
import { listActiveBlocks } from "@/server/blocks";

export const dynamic = "force-dynamic";

export default async function FloorPage() {
  const ctx = await getActiveVenue();
  const room = await db.room.findFirst({ where: { venueId: ctx.venueId } });
  const [tables, decor, blocks] = await Promise.all([
    db.table.findMany({
      where: { venueId: ctx.venueId },
      orderBy: { label: "asc" },
    }),
    db.floorDecor.findMany({
      where: { venueId: ctx.venueId },
      orderBy: { createdAt: "asc" },
    }),
    listActiveBlocks(ctx.venueId),
  ]);

  const totalSeats = tables.reduce((s, t) => s + t.seats, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <header>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Sala</p>
        <h1 className="text-display text-3xl">{room?.name ?? "Mappa sala"}</h1>
        <p className="text-sm text-muted-foreground">
          {tables.length} tavoli · {totalSeats} posti totali · {decor.length} elementi d&apos;arredo
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Editor visuale</CardTitle>
          <CardDescription>
            Trascina, ridimensiona, ruota. Aggiungi tavoli e arredi (piante, divani, bar, ecc.)
            dalla palette. Le modifiche restano locali finché non premi
            <span className="font-medium"> Salva sala</span>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FloorCanvas
            initialTables={tables}
            initialDecor={decor}
            width={room?.width ?? 1200}
            height={room?.height ?? 760}
          />
        </CardContent>
      </Card>

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
    </div>
  );
}
