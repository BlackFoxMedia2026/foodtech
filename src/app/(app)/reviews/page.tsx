import { MessageCircle, Star } from "lucide-react";
import { db } from "@/lib/db";
import { can, getActiveVenue } from "@/lib/tenant";
import { listReviews, reviewStats } from "@/server/reviews";
import { isGooglePlacesEnabled } from "@/lib/google-places";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Stat } from "@/components/ui/stat";
import { EmptyStateRich } from "@/components/ui/empty-state-rich";
import { ManualReviewDialog } from "@/components/reviews/manual-dialog";
import { SyncGoogleCard } from "@/components/reviews/sync-google";
import { ReviewDeleteButton } from "@/components/reviews/delete-button";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const SOURCE_LABEL: Record<string, string> = {
  GOOGLE: "Google",
  TRIPADVISOR: "TripAdvisor",
  FACEBOOK: "Facebook",
  YELP: "Yelp",
  TRUSTPILOT: "Trustpilot",
  MANUAL: "Manuale",
};

const SOURCE_TONE: Record<string, string> = {
  GOOGLE: "bg-status-vip-soft text-status-vip",
  TRIPADVISOR: "bg-status-confirmed-soft text-status-confirmed",
  FACEBOOK: "bg-status-vip-soft text-status-vip",
  YELP: "bg-status-no-show-soft text-status-no-show",
  TRUSTPILOT: "bg-status-confirmed-soft text-status-confirmed",
  MANUAL: "bg-secondary text-secondary",
};

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: { source?: string };
}) {
  const ctx = await getActiveVenue();
  const venue = await db.venue.findUnique({
    where: { id: ctx.venueId },
    select: { googlePlaceId: true },
  });
  const [items, stats] = await Promise.all([
    listReviews(ctx.venueId, 100, searchParams.source),
    reviewStats(ctx.venueId),
  ]);
  const canEdit = can(ctx.role, "edit_marketing");

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-tertiary">
            Ospiti · Reputation
          </p>
          <h1 className="text-display mt-1 text-[34px] font-medium leading-tight tracking-tight">
            Recensioni
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-secondary">
            Aggregatore delle recensioni pubbliche. Importa Google in 1 click o aggiungi
            manualmente quelle delle altre piattaforme.
          </p>
        </div>
        {canEdit && <ManualReviewDialog />}
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        <Stat label="Recensioni totali" value={stats.total} hint="archivio completo" emphasized />
        <Stat label="Ultimi 90 giorni" value={stats.last90} hint="acquisizione recente" />
        <Stat
          label="Media stelle"
          value={stats.avg ? stats.avg.toFixed(2) : "—"}
          hint={stats.avg && stats.avg >= 4 ? "ottima" : stats.avg ? "da migliorare" : "no dati"}
          delta={
            stats.avg && stats.avg >= 4
              ? { value: "★", tone: "positive" }
              : stats.avg && stats.avg < 3.5
                ? { value: "▼", tone: "negative" }
                : undefined
          }
        />
        <Stat label="Sorgenti attive" value={stats.bySource.length} hint="piattaforme tracciate" />
      </section>

      {canEdit && (
        <SyncGoogleCard
          initialPlaceId={venue?.googlePlaceId ?? null}
          apiEnabled={isGooglePlacesEnabled()}
        />
      )}

      <Panel>
        <PanelHeader
          title="Tutte le recensioni"
          description="Ordinate dalla più recente. Filtra per sorgente con le pillole a destra."
          action={
            <div className="flex flex-wrap gap-1">
              <SourcePill
                source={null}
                active={!searchParams.source}
                label="Tutte"
                count={stats.total}
              />
              {stats.bySource.map((s) => (
                <SourcePill
                  key={s.source}
                  source={s.source}
                  active={searchParams.source === s.source}
                  label={SOURCE_LABEL[s.source] ?? s.source}
                  count={s.count}
                />
              ))}
            </div>
          }
        />
        <PanelBody className="pt-0">
          {items.length === 0 ? (
            <EmptyStateRich
              icon={MessageCircle}
              title="Nessuna recensione importata"
              description="Sincronizza Google in 1 click o aggiungi recensioni delle altre piattaforme. Le recensioni TripAdvisor/Yelp si aggiungono manualmente perché le API sono closed."
            />
          ) : (
            <ul className="space-y-2.5">
              {items.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-[hsl(var(--surface-sunken))]/40 p-3.5"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="text-display grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary text-xs font-medium uppercase">
                      {r.authorName ? (
                        r.authorName.slice(0, 2)
                      ) : (
                        <MessageCircle className="h-4 w-4 text-tertiary" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{r.authorName ?? "Anonimo"}</p>
                        <Stars rating={r.rating} />
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-medium",
                            SOURCE_TONE[r.source] ?? "bg-secondary text-secondary",
                          )}
                        >
                          {SOURCE_LABEL[r.source] ?? r.source}
                        </span>
                      </div>
                      {r.text && (
                        <p className="mt-1.5 max-w-prose text-sm text-secondary line-clamp-4">
                          {r.text}
                        </p>
                      )}
                      <p className="mt-1.5 text-[11px] text-tertiary">
                        {r.publishedAt ? formatDate(r.publishedAt) : "—"}
                        {r.externalUrl && (
                          <>
                            {" · "}
                            <a
                              href={r.externalUrl}
                              target="_blank"
                              rel="noopener"
                              className="underline transition-colors hover:text-foreground"
                            >
                              Apri originale
                            </a>
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  {canEdit && <ReviewDeleteButton id={r.id} />}
                </li>
              ))}
            </ul>
          )}
        </PanelBody>
      </Panel>
    </div>
  );
}

function SourcePill({
  source,
  active,
  label,
  count,
}: {
  source: string | null;
  active: boolean;
  label: string;
  count: number;
}) {
  const href = source ? `/reviews?source=${source}` : "/reviews";
  return (
    <a
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
        active
          ? "bg-foreground text-background"
          : "bg-secondary/60 text-secondary hover:bg-secondary hover:text-foreground",
      )}
    >
      {label}
      <span
        className={cn(
          "rounded-full px-1.5 text-[10.5px] text-numeric",
          active ? "bg-background/15" : "bg-background/60 text-tertiary",
        )}
      >
        {count}
      </span>
    </a>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <span
      className="inline-flex items-center gap-0.5 text-gilt-light"
      aria-label={`${rating}/5 stelle`}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "h-3.5 w-3.5",
            i < rating ? "fill-current" : "opacity-25",
          )}
        />
      ))}
    </span>
  );
}
