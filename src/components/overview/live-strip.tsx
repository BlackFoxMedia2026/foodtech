import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type LiveChip = {
  key: string;
  label: string;
  value: string;
  icon: LucideIcon;
  href: string;
  tone?: "neutral" | "gold" | "vip" | "warning" | "danger" | "success";
  pulse?: boolean;
};

const TONE: Record<NonNullable<LiveChip["tone"]>, string> = {
  neutral: "text-foreground",
  gold: "text-gilt-dark",
  vip: "text-status-vip",
  warning: "text-status-pending",
  danger: "text-status-no-show",
  success: "text-status-confirmed",
};

const DOT_TONE: Record<NonNullable<LiveChip["tone"]>, string> = {
  neutral: "bg-tertiary",
  gold: "bg-gilt",
  vip: "bg-status-vip",
  warning: "bg-status-pending",
  danger: "bg-status-no-show",
  success: "bg-status-confirmed",
};

export function LiveStrip({ chips }: { chips: LiveChip[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
      {chips.map((chip) => {
        const tone = chip.tone ?? "neutral";
        const Icon = chip.icon;
        return (
          <Link
            key={chip.key}
            href={chip.href}
            className="group flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 transition-colors hover:border-border-strong"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[hsl(var(--surface-sunken))]">
              <Icon className={cn("h-4 w-4", TONE[tone])} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-tertiary">
                {chip.label}
              </p>
              <div className="flex items-center gap-1.5">
                <p className="text-display text-numeric text-lg font-medium leading-none">
                  {chip.value}
                </p>
                {chip.pulse && (
                  <span className="relative inline-flex h-1.5 w-1.5">
                    <span
                      className={cn(
                        "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
                        DOT_TONE[tone],
                      )}
                    />
                    <span
                      className={cn(
                        "relative inline-flex h-1.5 w-1.5 rounded-full",
                        DOT_TONE[tone],
                      )}
                    />
                  </span>
                )}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
