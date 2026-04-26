import { MessageCircle, Star, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { can, getActiveVenue } from "@/lib/tenant";
import { listReviews, reviewStats } from "@/server/reviews";
import { isGooglePlacesEnabled } from "@/lib/google-places";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/overview/stat-card";
import { ManualReviewDialog } from "@/components/reviews/manual-dialog";
import { SyncGoogleCard } from "@/components/reviews/sync-google";
import { ReviewDeleteButton } from "@/components/reviews/delete-button";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const SOURCE_LABEL: Record<string, string> = {
  GOOGLE: "Google",
  TRIPADVISOR: "TripAdvisor",
  FACEBOOK: "Facebook",
  YELP: "Yelp",
  TRUSTPILOT: "Trustpilot",
  MANUAL: "Manuale",
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
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Reputation</p>
          <h1 className="text-display text-3xl">Recensioni</h1>
          <p className="text-sm text-muted-foreground">
            Aggregatore delle recensioni pubbliche. Importa Google in 1 click o aggiungi
            manualmente quelle delle altre piattaforme.
          </p>
        </div>
        {canEdit && <ManualReviewDialog />}
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        <StatCard label="Totali" value={String(stats.total)} emphasize />
        <StatCard label="Ultimi 90gg" value={String(stats.last90)} />
        <StatCard
          label="Media stelle"
          value={stats.avg ? stats.avg.toFixed(2) : "—"}
        />
        <StatCard
          label="Sorgenti"
          value={String(stats.bySource.length)}
        />
      </section>

      {canEdit && (
        <SyncGoogleCard
          initialPlaceId={venue?.googlePlaceId ?? null}
          apiEnabled={isGooglePlacesEnabled()}
        />
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Tutte le recensioni</CardTitle>
              <CardDescription>
                Ordinate per data di pubblicazione (le più recenti prima).
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-1">
              <SourcePill source={null} active={!searchParams.source} label="Tutte" count={stats.total} />
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
          </div>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
              Nessuna recensione ancora. Sincronizza Google o aggiungile manualmente.
            </p>
          ) : (
            <ul className="space-y-3">
              {items.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-md border bg-background p-3"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="grid h-10 w-10 flex-none place-items-center rounded-full bg-secondary text-xs font-medium uppercase">
                      {r.authorName ? r.authorName.slice(0, 2) : <MessageCircle className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{r.authorName ?? "Anonimo"}</p>
                        <Stars rating={r.rating} />
                        <Badge tone="neutral">{SOURCE_LABEL[r.source] ?? r.source}</Badge>
                      </div>
                      {r.text && (
                        <p className="mt-1 max-w-prose text-sm text-muted-foreground line-clamp-4">
                          {r.text}
                        </p>
                      )}
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {r.publishedAt ? formatDate(r.publishedAt) : "—"}
                        {r.externalUrl && (
                          <>
                            {" · "}
                            <a href={r.externalUrl} target="_blank" rel="noopener" className="underline">
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
        </CardContent>
      </Card>
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
      className={
        active
          ? "rounded-full bg-foreground px-2.5 py-0.5 text-xs text-background"
          : "rounded-full border bg-background px-2.5 py-0.5 text-xs text-muted-foreground hover:bg-secondary"
      }
    >
      {label} <span className="opacity-60">· {count}</span>
    </a>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-gilt-dark" aria-label={`${rating}/5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={i < rating ? "h-3.5 w-3.5 fill-current" : "h-3.5 w-3.5 opacity-30"}
        />
      ))}
    </span>
  );
}
