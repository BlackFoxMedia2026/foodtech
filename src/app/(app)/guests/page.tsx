import { getActiveVenue } from "@/lib/tenant";
import { listGuests } from "@/server/guests";
import { GuestsTable } from "@/components/guests/guests-table";
import { ExportButton } from "@/components/ui/export-button";

export const dynamic = "force-dynamic";

export default async function GuestsPage({ searchParams }: { searchParams: { q?: string } }) {
  const ctx = await getActiveVenue();
  const guests = await listGuests(ctx.venueId, searchParams.q);

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">CRM</p>
          <h1 className="text-display text-3xl">Ospiti</h1>
          <p className="text-sm text-muted-foreground">{guests.length} risultati</p>
        </div>
        <ExportButton kind="guests" />
      </header>
      <GuestsTable rows={guests} />
    </div>
  );
}
