import Link from "next/link";
import { ArrowLeft, MessageCircle, Smile, Meh, Frown } from "lucide-react";
import { can, getActiveVenue } from "@/lib/tenant";
import { feedbackStats, listFeedback } from "@/server/surveys";
import { reviewLinkClickStats, reputationStats } from "@/server/review-links";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/overview/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ReviewLinksCard } from "@/components/reviews/review-links-card";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TONE = {
  PROMOTER: "success",
  PASSIVE: "warning",
  DETRACTOR: "danger",
} as const;

const ICON = {
  PROMOTER: Smile,
  PASSIVE: Meh,
  DETRACTOR: Frown,
} as const;

export default async function FeedbackPage() {
  const ctx = await getActiveVenue();
  const [stats, items, links, reputation] = await Promise.all([
    feedbackStats(ctx.venueId),
    listFeedback(ctx.venueId, 100),
    reviewLinkClickStats(ctx.venueId),
    reputationStats(ctx.venueId),
  ]);
  const canEditLinks = can(ctx.role, "manage_venue");

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/insights">
            <ArrowLeft className="h-4 w-4" /> Analytics
          </Link>
        </Button>
      </div>

      <header>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Feedback</p>
        <h1 className="text-display text-3xl">Reputazione</h1>
        <p className="text-sm text-muted-foreground">
          {stats.total} risposte · NPS {stats.nps} · {reputation.totalClicks} click verso recensioni esterne
        </p>
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        <StatCard label="NPS" value={String(stats.nps)} emphasize />
        <StatCard label="Punteggio medio" value={String(stats.avg)} />
        <StatCard label="Promotori" value={String(stats.promoter)} />
        <StatCard label="Click recensione" value={String(reputation.totalClicks)} hint={`${reputation.clicks30d} ultimi 30gg`} />
      </section>

      <ReviewLinksCard initial={links.map((l) => ({ ...l, label: l.label, clicks: l.clicks }))} canEdit={canEditLinks} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" /> Ultime risposte
          </CardTitle>
          <CardDescription>
            Inviate automaticamente ~4h dopo la chiusura della prenotazione.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              Nessun feedback ricevuto. Quando una prenotazione passa a COMPLETED, parte un sondaggio
              all&apos;ospite con email registrata.
            </p>
          ) : (
            <ul className="divide-y">
              {items.map((r) => {
                const Icon = ICON[r.sentiment];
                return (
                  <li key={r.id} className="flex flex-col gap-2 py-3 text-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-display text-2xl leading-none">{r.npsScore}</span>
                        <Badge tone={TONE[r.sentiment]}>{r.sentiment}</Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</span>
                    </div>
                    {r.comment && <p className="rounded-md bg-secondary px-3 py-2 italic text-foreground/90">&ldquo;{r.comment}&rdquo;</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
