import Link from "next/link";
import { ArrowRight, Bell, Lightbulb, Sparkles, TrendingUp } from "lucide-react";
import type { Suggestion } from "@/lib/ai";
import { cn } from "@/lib/utils";

const KIND_META = {
  ALERT: { icon: Bell, tone: "text-status-no-show bg-status-no-show-soft" },
  OPPORTUNITY: { icon: TrendingUp, tone: "text-gilt-dark bg-gilt/15" },
  INFO: { icon: Lightbulb, tone: "text-status-vip bg-status-vip-soft" },
  SUMMARY: { icon: Sparkles, tone: "text-gilt-dark bg-gilt/15" },
} as const;

export function AIConciergePanel({
  summary,
  suggestions,
  generatedBy,
}: {
  summary: string;
  suggestions: Suggestion[];
  generatedBy: string;
}) {
  const items = suggestions.filter((s) => s.kind !== "SUMMARY").slice(0, 4);

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-gilt/25 bg-gilt/[0.04] p-5">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gilt/15 text-gilt-dark">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-gilt-dark">
              Concierge AI
            </p>
            <p className="mt-0.5 text-[13.5px] font-medium leading-snug text-foreground">
              {summary}
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-card px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-tertiary">
          {generatedBy === "heuristic" ? "auto" : generatedBy}
        </span>
      </header>

      {items.length > 0 ? (
        <ul className="space-y-2">
          {items.map((s) => {
            const meta = KIND_META[s.kind as keyof typeof KIND_META] ?? KIND_META.INFO;
            const Icon = meta.icon;
            return (
              <li key={s.id}>
                <Link
                  href={s.actionHref ?? "#"}
                  className="group flex items-start gap-3 rounded-lg border border-border bg-card px-3 py-2.5 transition-colors hover:border-border-strong"
                >
                  <span
                    className={cn(
                      "grid h-7 w-7 shrink-0 place-items-center rounded-full",
                      meta.tone,
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-foreground">{s.title}</p>
                    {s.body && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-secondary">{s.body}</p>
                    )}
                  </div>
                  {s.actionLabel && (
                    <span className="flex shrink-0 items-center gap-1 self-center text-[11px] font-medium text-tertiary transition-colors group-hover:text-foreground">
                      {s.actionLabel} <ArrowRight className="h-3 w-3" />
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-border bg-card/60 px-3 py-4 text-center text-xs text-tertiary">
          Nessun suggerimento per ora. Il concierge sta osservando il servizio.
        </p>
      )}
    </section>
  );
}
