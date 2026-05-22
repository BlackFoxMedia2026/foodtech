import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyStateRich({
  icon: Icon,
  title,
  description,
  primary,
  secondary,
  hint,
  className,
  size = "default",
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  primary?: React.ReactNode;
  secondary?: React.ReactNode;
  hint?: string;
  className?: string;
  size?: "default" | "compact";
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border-strong/50 bg-[hsl(var(--surface-sunken))]/30 text-center",
        size === "compact" ? "gap-2 px-5 py-7" : "gap-3 px-6 py-10",
        className,
      )}
    >
      {Icon && (
        <span className="grid h-10 w-10 place-items-center rounded-full bg-card text-tertiary shadow-soft">
          <Icon className="h-5 w-5" />
        </span>
      )}
      <div className="max-w-sm">
        <p className="text-display text-base font-medium tracking-tight">{title}</p>
        {description && (
          <p className="mt-1 text-sm text-secondary leading-snug">{description}</p>
        )}
      </div>
      {(primary || secondary) && (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          {primary}
          {secondary}
        </div>
      )}
      {hint && (
        <p className="text-[11px] italic text-tertiary">{hint}</p>
      )}
    </div>
  );
}
