import Link from "next/link";
import { ArrowLeft, MessageCircle, Smile, Meh, Frown, type LucideIcon } from "lucide-react";
import { can, getActiveVenue } from "@/lib/tenant";
import { feedbackStats, listFeedback } from "@/server/surveys";
import { reviewLinkClickStats, reputationStats } from "@/server/review-links";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Stat } from "@/components/ui/stat";
import { EmptyStateRich } from "@/components/ui/empty-state-rich";
import { ReviewLinksCard } from "@/components/reviews/review-links-card";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const SENTIMENT_META: Record<
  "PROMOTER" | "PASSIVE" | "DETRACTOR",
  { label: string; icon: LucideIcon; tone: string }
> = {
  PROMOTER: {
    label: "Promotore",
    icon: Smile,
    tone: "text-status-confirmed bg-status-confirmed-soft",
  },
  PASSIVE: {
    label: "Passivo",
    icon: Meh,
    tone: "text-status-pending bg-status-pending-soft",
  },
  DETRACTOR: {
    label: "Detrattore",
    icon: Frown,
    tone: "text-status-no-show bg-status-no-show-soft",
  },
};

export default async function FeedbackPage() {
  const ctx = await getActiveVenue();
  const [stats, items, links, reputation] = await Promise.all([
    feedbackStats(ctx.venueId),
    listFeedback(ctx.venueId, 100),
    reviewLinkClickStats(ctx.venueId),
    reputationStats(ctx.venueId),
  ]);
  const canEditLinks = can(ctx.role, "manage_venue");

  const npsTone =
    stats.nps >= 50 ? "success" : stats.nps >= 0 ? undefined : "danger";

  return (
    <div className="space-y-6 animate-fade-in">
      <Link
        href="/insights"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-secondary transition hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Analytics
      </Link>

      <header>
        <p className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-tertiary">
          Ospiti · Sondaggi & reputazione
        </p>
        <h1 className="text-display mt-1 text-[34px] font-medium leading-tight tracking-tight">
          Reputazione
        </h1>
        <p className="mt-1 text-sm text-secondary">
          <span className="text-numeric text-foreground">{stats.total}</span> risposte ·{" "}
          NPS <span className="text-numeric text-foreground">{stats.nps}</span> ·{" "}
          <span className="text-numeric text-foreground">{reputation.totalClicks}</span> click verso recensioni esterne
        </p>
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        <Stat
          label="Net Promoter Score"
          value={stats.nps}
          hint={
            stats.nps >= 50
              ? "ottimo"
              : stats.nps >= 0
                ? "stabile"
                : "critico"
          }
          emphasized
          delta={
            npsTone === "success"
              ? { value: "+", tone: "positive" }
              : npsTone === "danger"
                ? { value: "−", tone: "negative" }
                : undefined
          }
        />
        <Stat label="Punteggio medio" value={stats.avg} hint="su 10" />
        <Stat
          label="Promotori"
          value={stats.promoter}
          hint={`vs ${stats.detractor} detrattori`}
        />
        <Stat
          label="Click recensione"
          value={reputation.totalClicks}
          hint={`${reputation.clicks30d} ultimi 30gg`}
        />
      </section>

      <ReviewLinksCard
        initial={links.map((l) => ({ ...l, label: l.label, clicks: l.clicks }))}
        canEdit={canEditLinks}
      />

      <Panel>
        <PanelHeader
          title={
            <span className="inline-flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-tertiary" /> Ultime risposte
            </span>
          }
          description="Inviate automaticamente ~4h dopo la chiusura della prenotazione."
        />
        <PanelBody className="pt-0">
          {items.length === 0 ? (
            <EmptyStateRich
              icon={MessageCircle}
              title="Nessun feedback ricevuto"
              description="Quando una prenotazione passa a COMPLETED parte un sondaggio all'ospite con email registrata. Le risposte appariranno qui."
              hint="Il flusso di invio funziona se Resend è configurato e l'ospite ha un'email."
            />
          ) : (
            <ul className="divide-y divide-border">
              {items.map((r) => {
                const meta = SENTIMENT_META[r.sentiment];
                const Icon = meta.icon;
                return (
                  <li key={r.id} className="flex flex-col gap-2 py-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "grid h-9 w-9 shrink-0 place-items-center rounded-full",
                            meta.tone,
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="text-display text-numeric text-2xl font-medium leading-none">
                            {r.npsScore}
                            <span className="ml-1 text-xs text-tertiary text-numeric">/10</span>
                          </p>
                          <p className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.14em] text-tertiary">
                            {meta.label}
                          </p>
                        </div>
                      </div>
                      <span className="text-[11px] text-tertiary text-numeric">
                        {formatDateTime(r.createdAt)}
                      </span>
                    </div>
                    {r.comment && (
                      <p className="rounded-lg bg-[hsl(var(--surface-sunken))]/50 px-3 py-2.5 text-sm italic text-foreground/90">
                        &ldquo;{r.comment}&rdquo;
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </PanelBody>
      </Panel>
    </div>
  );
}
