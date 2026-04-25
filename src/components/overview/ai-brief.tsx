import Link from "next/link";
import { ArrowRight, Bell, Lightbulb, Sparkles, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Suggestion } from "@/lib/ai";

const ICON = {
  ALERT: Bell,
  OPPORTUNITY: TrendingUp,
  INFO: Lightbulb,
  SUMMARY: Sparkles,
} as const;

const TONE: Record<Suggestion["kind"], string> = {
  ALERT: "border-rose-200 bg-rose-50 text-rose-700",
  OPPORTUNITY: "border-gilt/40 bg-gilt/10 text-gilt-dark",
  INFO: "border-sky-200 bg-sky-50 text-sky-700",
  SUMMARY: "border-border bg-secondary text-foreground",
};

export function AIBrief({
  summary,
  suggestions,
  generatedBy,
}: {
  summary: string;
  suggestions: Suggestion[];
  generatedBy: string;
}) {
  const items = suggestions.filter((s) => s.kind !== "SUMMARY");
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-gilt-dark" /> Brief operativo
            </CardTitle>
            <CardDescription>{summary}</CardDescription>
          </div>
          <Badge tone={generatedBy === "heuristic" ? "neutral" : "gold"}>{generatedBy}</Badge>
        </div>
      </CardHeader>
      {items.length > 0 && (
        <CardContent className="space-y-2">
          {items.map((s) => {
            const Icon = ICON[s.kind] ?? Sparkles;
            return (
              <div
                key={s.id}
                className={`flex items-start justify-between gap-3 rounded-md border p-3 text-sm ${TONE[s.kind]}`}
              >
                <div className="flex items-start gap-2">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-medium">{s.title}</p>
                    <p className="text-xs opacity-80">{s.body}</p>
                  </div>
                </div>
                {s.actionHref && s.actionLabel && (
                  <Link
                    href={s.actionHref}
                    className="inline-flex shrink-0 items-center gap-1 text-xs font-medium hover:underline"
                  >
                    {s.actionLabel} <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            );
          })}
        </CardContent>
      )}
    </Card>
  );
}
