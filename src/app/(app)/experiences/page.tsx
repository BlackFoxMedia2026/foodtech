import Link from "next/link";
import { Sparkles, ExternalLink, QrCode } from "lucide-react";
import { db } from "@/lib/db";
import { getActiveVenue } from "@/lib/tenant";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { EmptyStateRich } from "@/components/ui/empty-state-rich";
import { ExperienceDialog } from "@/components/experiences/experience-dialog";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ExperiencesPage() {
  const ctx = await getActiveVenue();
  const items = await db.experience.findMany({
    where: { venueId: ctx.venueId },
    orderBy: { startsAt: "asc" },
    include: { tickets: true },
  });

  const published = items.filter((e) => e.published).length;
  const totalSold = items.reduce(
    (s, e) => s + e.tickets.reduce((acc, t) => acc + t.quantity, 0),
    0,
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-tertiary">
            Vendite · Programma & ticket
          </p>
          <h1 className="text-display mt-1 text-[34px] font-medium leading-tight tracking-tight">
            Esperienze
          </h1>
          <p className="mt-1 text-sm text-secondary">
            <span className="text-numeric text-foreground">{items.length}</span> eventi ·{" "}
            <span className="text-numeric text-foreground">{published}</span> pubblicati ·{" "}
            <span className="text-numeric text-foreground">{totalSold}</span> ticket venduti
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/events/scan"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-secondary transition-colors hover:border-border-strong hover:text-foreground"
          >
            <QrCode className="h-3.5 w-3.5" /> Check-in ticket
          </Link>
          <ExperienceDialog />
        </div>
      </header>

      {items.length === 0 ? (
        <EmptyStateRich
          icon={Sparkles}
          title="Nessuna esperienza in calendario"
          description="Crea il primo evento (cena degustazione, DJ set, masterclass) per metterlo nel widget pubblico e vendere ticket online."
          primary={<ExperienceDialog />}
          hint="Le esperienze sono integrate col CRM: ogni acquirente diventa un guest tracciato."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((e) => {
            const sold = e.tickets.reduce((s, t) => s + t.quantity, 0);
            const pct = Math.min(100, (sold / Math.max(1, e.capacity)) * 100);
            const sellTone =
              pct >= 90
                ? "text-status-no-show"
                : pct >= 60
                  ? "text-status-pending"
                  : "text-status-confirmed";
            return (
              <Panel key={e.id}>
                <PanelHeader
                  title={e.title}
                  description={formatDateTime(e.startsAt)}
                  action={
                    <ExperienceDialog
                      triggerLabel="Modifica"
                      triggerIcon="edit"
                      triggerVariant="ghost"
                      triggerSize="sm"
                      initial={{
                        id: e.id,
                        title: e.title,
                        slug: e.slug,
                        description: e.description,
                        startsAt: e.startsAt.toISOString(),
                        endsAt: e.endsAt.toISOString(),
                        capacity: e.capacity,
                        priceCents: e.priceCents,
                        ticketUrl: e.ticketUrl,
                        coverImage: e.coverImage,
                        published: e.published,
                      }}
                    />
                  }
                />
                <PanelBody className="space-y-3 pt-0 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium",
                        e.published
                          ? "bg-status-confirmed-soft text-status-confirmed"
                          : "bg-secondary text-secondary",
                      )}
                    >
                      <Sparkles className="h-3 w-3" />
                      {e.published ? "Pubblicata" : "Bozza"}
                    </span>
                    <span className="text-display text-numeric text-xl font-medium text-gilt-light">
                      {e.priceCents > 0
                        ? formatCurrency(e.priceCents, ctx.venue.currency)
                        : "Gratis"}
                    </span>
                  </div>

                  {e.description && (
                    <p className="text-tertiary line-clamp-3">{e.description}</p>
                  )}

                  <div>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-tertiary">
                        Vendite ticket
                      </span>
                      <span
                        className={cn(
                          "text-display text-numeric text-sm font-medium",
                          sellTone,
                        )}
                      >
                        {sold}
                        <span className="text-tertiary">/{e.capacity}</span>
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className={cn(
                          "h-full transition-all duration-700",
                          pct >= 90
                            ? "bg-status-no-show"
                            : pct >= 60
                              ? "bg-status-pending"
                              : "bg-gilt",
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {e.published && (
                    <Link
                      href={`/e/${ctx.venue.slug}/${e.slug}`}
                      target="_blank"
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-secondary transition-colors hover:text-foreground"
                    >
                      Apri pagina pubblica <ExternalLink className="h-3 w-3" />
                    </Link>
                  )}
                </PanelBody>
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}
