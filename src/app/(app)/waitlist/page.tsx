import { db } from "@/lib/db";
import { getActiveVenue } from "@/lib/tenant";
import { listActiveWaitlist, listClosedWaitlist } from "@/server/waitlist";
import { WaitlistBoard } from "@/components/waitlist/waitlist-board";

export const dynamic = "force-dynamic";

export default async function WaitlistPage() {
  const ctx = await getActiveVenue();
  const [active, closed, tables] = await Promise.all([
    listActiveWaitlist(ctx.venueId),
    listClosedWaitlist(ctx.venueId),
    db.table.findMany({
      where: { venueId: ctx.venueId, active: true },
      select: { id: true, label: true, seats: true },
      orderBy: { label: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6 animate-fade-in">
      <header>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Sala</p>
        <h1 className="text-display text-3xl">Lista d&apos;attesa</h1>
        <p className="text-sm text-muted-foreground">
          {active.length} in attesa · {closed.filter((c) => c.status === "SEATED").length} accolti oggi
        </p>
      </header>
      <WaitlistBoard
        active={active.map((a) => ({
          id: a.id,
          guestName: a.guestName,
          phone: a.phone,
          email: a.email,
          partySize: a.partySize,
          expectedWaitMin: a.expectedWaitMin,
          status: a.status,
          createdAt: a.createdAt.toISOString(),
          notifiedAt: a.notifiedAt?.toISOString() ?? null,
          notes: a.notes,
        }))}
        closed={closed.map((c) => ({
          id: c.id,
          guestName: c.guestName,
          partySize: c.partySize,
          status: c.status,
          updatedAt: c.updatedAt.toISOString(),
        }))}
        tables={tables}
      />
    </div>
  );
}
