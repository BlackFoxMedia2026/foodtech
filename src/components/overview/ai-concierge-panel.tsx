import Link from "next/link";
import { ArrowRight, Bell, Lightbulb, Sparkles, TrendingUp } from "lucide-react";
import type { Suggestion } from "@/lib/ai";
import { cn } from "@/lib/utils";

const KIND_META = {
  ALERT: {
    icon: Bell,
    tone: "text-rose-300 bg-rose-400/15",
    toneLight: "text-status-no-show bg-status-no-show-soft",
  },
  OPPORTUNITY: {
    icon: TrendingUp,
    tone: "text-gilt-light bg-gilt/15",
    toneLight: "text-gilt-dark bg-gilt/15",
  },
  INFO: {
    icon: Lightbulb,
    tone: "text-sky-300 bg-sky-400/15",
    toneLight: "text-status-vip bg-status-vip-soft",
  },
  SUMMARY: {
    icon: Sparkles,
    tone: "text-gilt-light bg-gilt/15",
    toneLight: "text-gilt-dark bg-gilt/15",
  },
} as const;

export function AIConciergePanel({
  summary,
  suggestions,
  generatedBy,
  variant = "light",
}: {
  summary: string;
  suggestions: Suggestion[];
  generatedBy: string;
  variant?: "light" | "dark";
}) {
  const items = suggestions.filter((s) => s.kind !== "SUMMARY").slice(0, 4);
  const dark = variant === "dark";

  return (
    <section
      className={cn(
        "flex flex-col gap-5 rounded-2xl p-6",
        dark
          ? "border border-white/8 bg-carbon-800 text-sand-50"
          : "border border-gilt/25 bg-gilt/[0.04]",
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "grid h-11 w-11 shrink-0 place-items-center rounded-2xl",
              dark ? "bg-gilt/20 text-gilt-light" : "bg-gilt/15 text-gilt-dark",
            )}
          >
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p
              className={cn(
                "text-[11px] font-medium uppercase tracking-[0.18em]",
                dark ? "text-gilt-light" : "text-gilt-dark",
              )}
            >
              Concierge AI
            </p>
            <p
              className={cn(
                "mt-1 text-[15px] font-medium leading-snug",
                dark ? "text-sand-50" : "text-foreground",
              )}
            >
              {summary}
            </p>
          </div>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em]",
            dark
              ? "bg-white/8 text-sand-50/55"
              : "bg-card text-tertiary",
          )}
        >
          {generatedBy === "heuristic" ? "auto" : generatedBy}
        </span>
      </header>

      {items.length > 0 ? (
        <ul className="space-y-2.5">
          {items.map((s) => {
            const meta = KIND_META[s.kind as keyof typeof KIND_META] ?? KIND_META.INFO;
            const Icon = meta.icon;
            return (
              <li key={s.id}>
                <Link
                  href={s.actionHref ?? "#"}
                  className={cn(
                    "group flex items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors",
                    dark
                      ? "border-white/10 bg-white/[0.04] hover:border-white/25"
                      : "border-border bg-card hover:border-border-strong",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-8 w-8 shrink-0 place-items-center rounded-full",
                      dark ? meta.tone : meta.toneLight,
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-[14px] font-medium leading-snug",
                        dark ? "text-sand-50" : "text-foreground",
                      )}
                    >
                      {s.title}
                    </p>
                    {s.body && (
                      <p
                        className={cn(
                          "mt-1 line-clamp-2 text-[12.5px] leading-snug",
                          dark ? "text-sand-50/65" : "text-secondary",
                        )}
                      >
                        {s.body}
                      </p>
                    )}
                  </div>
                  {s.actionLabel && (
                    <span
                      className={cn(
                        "flex shrink-0 items-center gap-1 self-center text-[11.5px] font-medium transition-colors",
                        dark
                          ? "text-sand-50/55 group-hover:text-sand-50"
                          : "text-tertiary group-hover:text-foreground",
                      )}
                    >
                      {s.actionLabel} <ArrowRight className="h-3 w-3" />
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p
          className={cn(
            "rounded-xl border border-dashed px-3 py-5 text-center text-[12.5px]",
            dark
              ? "border-white/15 bg-white/[0.02] text-sand-50/55"
              : "border-border bg-card text-tertiary",
          )}
        >
          Nessun suggerimento per ora. Il concierge sta osservando il servizio.
        </p>
      )}
    </section>
  );
}
