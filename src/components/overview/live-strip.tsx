import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type LiveChip = {
  key: string;
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  href: string;
  tone?: "neutral" | "gold" | "vip" | "warning" | "danger" | "success";
  pulse?: boolean;
};

const TEXT_TONE: Record<NonNullable<LiveChip["tone"]>, string> = {
  neutral: "text-foreground",
  gold: "text-gilt-dark",
  vip: "text-status-vip",
  warning: "text-status-pending",
  danger: "text-status-no-show",
  success: "text-status-confirmed",
};

const ICON_BG: Record<NonNullable<LiveChip["tone"]>, string> = {
  neutral: "bg-[hsl(var(--surface-sunken))] text-tertiary",
  gold: "bg-gilt/15 text-gilt-dark",
  vip: "bg-status-vip-soft text-status-vip",
  warning: "bg-status-pending-soft text-status-pending",
  danger: "bg-status-no-show-soft text-status-no-show",
  success: "bg-status-confirmed-soft text-status-confirmed",
};

const DOT: Record<NonNullable<LiveChip["tone"]>, string> = {
  neutral: "bg-tertiary",
  gold: "bg-gilt",
  vip: "bg-status-vip",
  warning: "bg-status-pending",
  danger: "bg-status-no-show",
  success: "bg-status-confirmed",
};

export function LiveStrip({ chips }: { chips: LiveChip[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      {chips.map((chip) => {
        const tone = chip.tone ?? "neutral";
        const Icon = chip.icon;
        return (
          <Link
            key={chip.key}
            href={chip.href}
            className="group relative flex items-center gap-4 rounded-2xl border border-border bg-card px-4 py-4 transition-all hover:border-border-strong hover:shadow-soft"
          >
            <span
              className={cn(
                "grid h-12 w-12 shrink-0 place-items-center rounded-xl",
                ICON_BG[tone],
              )}
            >
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-tertiary">
                {chip.label}
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <p
                  className={cn(
                    "text-display text-numeric text-3xl font-medium leading-none tabular-nums",
                    TEXT_TONE[tone],
                  )}
                >
                  {chip.value}
                </p>
                {chip.pulse && (
                  <span className="relative inline-flex h-2 w-2">
                    <span
                      className={cn(
                        "absolute inline-flex h-full w-full animate-ping rounded-full opacity-70",
                        DOT[tone],
                      )}
                    />
                    <span
                      className={cn(
                        "relative inline-flex h-2 w-2 rounded-full",
                        DOT[tone],
                      )}
                    />
                  </span>
                )}
              </div>
              {chip.hint && (
                <p className="mt-1 truncate text-[11px] text-tertiary">
                  {chip.hint}
                </p>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
