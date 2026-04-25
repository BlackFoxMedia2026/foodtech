import Link from "next/link";
import { db } from "@/lib/db";
import { getActiveVenue } from "@/lib/tenant";
import { listBookingsForDay } from "@/server/bookings";
import { BookingsTable } from "@/components/bookings/bookings-table";
import { BookingsTimeline } from "@/components/bookings/bookings-timeline";
import { NewBookingButton } from "@/components/bookings/new-booking-button";
import { DayPicker } from "@/components/bookings/day-picker";
import { ExportButton } from "@/components/ui/export-button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: { day?: string; view?: string };
}) {
  const ctx = await getActiveVenue();
  const day = searchParams.day ? new Date(searchParams.day) : new Date();
  const dayString = day.toISOString().slice(0, 10);
  const view = searchParams.view === "timeline" ? "timeline" : "list";

  const [rows, tables] = await Promise.all([
    listBookingsForDay(ctx.venueId, day),
    db.table.findMany({
      where: { venueId: ctx.venueId, active: true },
      select: { id: true, label: true, seats: true },
      orderBy: { label: "asc" },
    }),
  ]);

  const totalCovers = rows.filter((r) => r.status !== "CANCELLED").reduce((s, b) => s + b.partySize, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Sala</p>
          <h1 className="text-display text-3xl">Prenotazioni</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} prenotazioni · {totalCovers} coperti
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center rounded-md border bg-background p-1 text-xs">
            <ViewTab href={`/bookings?day=${dayString}&view=list`} active={view === "list"}>
              Lista
            </ViewTab>
            <ViewTab href={`/bookings?day=${dayString}&view=timeline`} active={view === "timeline"}>
              Timeline
            </ViewTab>
          </div>
          <DayPicker value={dayString} />
          <ExportButton kind="bookings" />
          <NewBookingButton tables={tables} />
        </div>
      </header>

      {view === "timeline" ? (
        <BookingsTimeline rows={rows} tables={tables} day={dayString} />
      ) : (
        <BookingsTable rows={rows} />
      )}
    </div>
  );
}

function ViewTab({
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
        "rounded-sm px-3 py-1.5",
        active ? "bg-carbon-800 text-sand-50" : "text-muted-foreground hover:bg-secondary",
      )}
    >
      {children}
    </Link>
  );
}
