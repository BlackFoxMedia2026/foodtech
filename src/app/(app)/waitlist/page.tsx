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
        <p className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-tertiary">
          Oggi · Operazioni sala
        </p>
        <h1 className="text-display mt-1 text-[34px] font-medium leading-tight tracking-tight">
          Lista d&apos;attesa
        </h1>
        <p className="mt-1 text-sm text-secondary">
          Walk-in e overbooking in tempo reale: notifica, offri, accomoda con un click.
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
