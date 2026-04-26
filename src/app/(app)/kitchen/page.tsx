import { ChefHat } from "lucide-react";
import { can, getActiveVenue } from "@/lib/tenant";
import { kitchenTickets, summariseTickets } from "@/server/kitchen";
import { StatCard } from "@/components/overview/stat-card";
import { KitchenBoard } from "@/components/kitchen/kitchen-board";

export const dynamic = "force-dynamic";

export default async function KitchenPage() {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "manage_bookings")) {
    return (
      <div className="rounded-md border p-8 text-sm text-muted-foreground">
        Accesso riservato allo staff di servizio.
      </div>
    );
  }
  const tickets = await kitchenTickets(ctx.venueId);
  const summary = summariseTickets(tickets);

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Servizio</p>
          <h1 className="text-display text-3xl flex items-center gap-2">
            <ChefHat className="h-7 w-7" /> Cucina
          </h1>
          <p className="text-sm text-muted-foreground">
            Pre-order della sala + ordini asporto/delivery in un&apos;unica board.
          </p>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        <StatCard label="Ticket attivi" value={String(summary.total)} emphasize />
        <StatCard label="Pre-order sala" value={String(summary.bySource.PREORDER)} />
        <StatCard label="Asporto / delivery" value={String(summary.bySource.ORDER)} />
        <StatCard
          label="Prossimo"
          value={
            summary.earliestAt
              ? summary.earliestAt.toLocaleTimeString("it-IT", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—"
          }
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
