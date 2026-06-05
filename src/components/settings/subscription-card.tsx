import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatLimit, type PlanName } from "@/lib/plan-limits";

type UsageRow = {
  label: string;
  used: number;
  max: number;
  hint?: string;
};

export function SubscriptionCard({
  plan,
  usage,
}: {
  plan: PlanName;
  usage: UsageRow[];
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Abbonamento</CardTitle>
            <CardDescription>
              Piano attuale e utilizzo del 30gg corrente. I limiti vengono applicati alla
              creazione delle risorse.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="gold" className="text-xs uppercase tracking-wider">
              {plan}
            </Badge>
            <Button asChild variant="outline" size="sm">
              <Link href="/pricing">
                Confronta piani <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {usage.map((row) => {
            const max = row.max;
            const maxLabel = formatLimit(max);
            const pct =
              max === Infinity
                ? 0
                : max === 0
                  ? 100
                  : Math.min(100, Math.round((row.used / max) * 100));
            const nearCap = max !== Infinity && pct >= 80;
            return (
              <div
                key={row.label}
                className="rounded-md border bg-background p-3"
              >
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  {row.label}
                </p>
                <p className="mt-1 text-xl font-medium tabular-nums">
                  {row.used}
                  <span className="text-sm text-muted-foreground"> / {maxLabel}</span>
                </p>
                {max !== Infinity && (
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className={
                        nearCap
                          ? "h-full bg-amber-500"
                          : "h-full bg-gilt"
                      }
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
                {row.hint && (
                  <p className="mt-1 text-[11px] text-muted-foreground">{row.hint}</p>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
