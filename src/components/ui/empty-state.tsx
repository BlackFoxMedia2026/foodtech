import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border-strong/60 bg-[hsl(var(--surface-sunken))]/40 px-6 py-12 text-center",
        className,
      )}
    >
      {Icon && (
        <span className="grid h-10 w-10 place-items-center rounded-full bg-card text-tertiary shadow-soft">
          <Icon className="h-5 w-5" />
        </span>
      )}
      <div>
        <p className="text-display text-base font-medium tracking-tight">{title}</p>
        {description && (
          <p className="mt-1 max-w-sm text-sm text-secondary">{description}</p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
