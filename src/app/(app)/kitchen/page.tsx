import { ChefHat } from "lucide-react";
import { can, getActiveVenue } from "@/lib/tenant";
import { kitchenTickets, summariseTickets } from "@/server/kitchen";
import { Stat } from "@/components/ui/stat";
import { EmptyStateRich } from "@/components/ui/empty-state-rich";
import { KitchenBoard } from "@/components/kitchen/kitchen-board";

export const dynamic = "force-dynamic";

export default async function KitchenPage() {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "manage_bookings")) {
    return (
      <EmptyStateRich
        icon={ChefHat}
        title="Accesso riservato"
        description="La cucina è accessibile solo allo staff di servizio (Manager, Reception, Cameriere)."
      />
    );
  }
  const tickets = await kitchenTickets(ctx.venueId);
  const summary = summariseTickets(tickets);

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-tertiary">
            Oggi · Servizio cucina
          </p>
          <h1 className="text-display mt-1 flex items-center gap-3 text-[34px] font-medium leading-tight tracking-tight">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gilt/15 text-gilt-light">
              <ChefHat className="h-5 w-5" />
            </span>
            Cucina
          </h1>
          <p className="mt-1 text-sm text-secondary">
            Pre-order della sala + ordini asporto/delivery in un&apos;unica board live.
          </p>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        <Stat label="Ticket attivi" value={summary.total} hint="da gestire" emphasized />
        <Stat label="Pre-order sala" value={summary.bySource.PREORDER} hint="ordini al tavolo" />
        <Stat label="Asporto & delivery" value={summary.bySource.ORDER} hint="da consegnare" />
        <Stat
          label="Prossimo"
          value={
            summary.earliestAt
              ? summary.earliestAt.toLocaleTimeString("it-IT", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—"
          }
          hint={summary.earliestAt ? "scadenza ravvicinata" : "nessuna scadenza"}
        />
      </section>

      <KitchenBoard
        initialTickets={tickets.map((t) => ({
          ...t,
          scheduledAt: t.scheduledAt.toISOString(),
        }))}
      />
    </div>
  );
}
