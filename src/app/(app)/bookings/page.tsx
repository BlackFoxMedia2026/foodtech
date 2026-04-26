import Link from "next/link";
import { db } from "@/lib/db";
import { getActiveVenue } from "@/lib/tenant";
import { listBookingsForDay } from "@/server/bookings";
import { BookingsTable } from "@/components/bookings/bookings-table";
import { BookingsTimeline } from "@/components/bookings/bookings-timeline";
import { BookingsWeek } from "@/components/bookings/bookings-week";
import { NewBookingButton } from "@/components/bookings/new-booking-button";
import { DayPicker } from "@/components/bookings/day-picker";
import { ExportButton } from "@/components/ui/export-button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type View = "list" | "timeline" | "week";

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: { day?: string; view?: string };
}) {
  const ctx = await getActiveVenue();
  const day = searchParams.day ? new Date(searchParams.day) : new Date();
  const dayString = day.toISOString().slice(0, 10);
  const view: View =
    searchParams.view === "timeline"
      ? "timeline"
      : searchParams.view === "week"
        ? "week"
        : "list";

  const tables = await db.table.findMany({
    where: { venueId: ctx.venueId, active: true },
    select: { id: true, label: true, seats: true },
    orderBy: { label: "asc" },
  });

  if (view === "week") {
    // Week starts on Monday (locale-friendly)
    const start = new Date(day);
    const dow = start.getDay(); // 0 sun..6 sat
    const offset = dow === 0 ? -6 : 1 - dow;
    start.setDate(start.getDate() + offset);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    const weekRows = await db.booking.findMany({
      where: {
        venueId: ctx.venueId,
        startsAt: { gte: start, lt: end },
      },
      orderBy: { startsAt: "asc" },
      select: {
        id: true,
        startsAt: true,
        partySize: true,
        status: true,
        occasion: true,
        guest: { select: { firstName: true, lastName: true, loyaltyTier: true } },
      },
    });
    const weekStart = start.toISOString().slice(0, 10);
    const totalCovers = weekRows
      .filter((r) => r.status !== "CANCELLED")
      .reduce((s, b) => s + b.partySize, 0);
    return (
      <div className="space-y-6 animate-fade-in">
        <Header
          dayString={dayString}
          view="week"
          totalCovers={totalCovers}
          totalBookings={weekRows.length}
          tables={tables}
          subtitle="Vista settimanale"
        />
        <BookingsWeek
          bookings={weekRows.map((r) => ({
            id: r.id,
            startsAt: r.startsAt.toISOString(),
            partySize: r.partySize,
            status: r.status,
            occasion: r.occasion,
            guest: r.guest,
          }))}
          weekStart={weekStart}
        />
      </div>
    );
  }

  const rows = await listBookingsForDay(ctx.venueId, day);
  const totalCovers = rows.filter((r) => r.status !== "CANCELLED").reduce((s, b) => s + b.partySize, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <Header
        dayString={dayString}
        view={view}
        totalCovers={totalCovers}
        totalBookings={rows.length}
        tables={tables}
      />
      {view === "timeline" ? (
        <BookingsTimeline rows={rows} tables={tables} day={dayString} />
      ) : (
        <BookingsTable rows={rows} />
      )}
    </div>
  );
}

function Header({
  dayString,
  view,
  totalCovers,
  totalBookings,
  tables,
  subtitle,
}: {
  dayString: string;
  view: View;
  totalCovers: number;
  totalBookings: number;
  tables: { id: string; label: string; seats: number }[];
  subtitle?: string;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Sala</p>
        <h1 className="text-display text-3xl">Prenotazioni</h1>
        <p className="text-sm text-muted-foreground">
          {subtitle ? `${subtitle} · ` : ""}
          {totalBookings} prenotazioni · {totalCovers} coperti
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
          <ViewTab href={`/bookings?day=${dayString}&view=week`} active={view === "week"}>
            Settimana
          </ViewTab>
        </div>
        <DayPicker value={dayString} />
        <ExportButton kind="bookings" />
        <NewBookingButton tables={tables} />
      </div>
    </header>
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
