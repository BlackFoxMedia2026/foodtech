import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatDelta = {
  value: string;
  direction?: "up" | "down" | "flat";
  tone?: "positive" | "negative" | "neutral";
};

export function Stat({
  label,
  value,
  hint,
  delta,
  icon: Icon,
  className,
  emphasized,
}: {
  label: string;
  value: string | number;
  hint?: string;
  delta?: StatDelta;
  icon?: LucideIcon;
  className?: string;
  emphasized?: boolean;
}) {
  const direction = delta?.direction ?? (delta?.tone === "positive" ? "up" : delta?.tone === "negative" ? "down" : "flat");
  const Arrow = direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Minus;
  const deltaTone =
    delta?.tone === "positive"
      ? "text-status-confirmed"
      : delta?.tone === "negative"
        ? "text-status-no-show"
        : "text-tertiary";

  return (
    <div
      className={cn(
        "panel relative flex flex-col gap-3 p-5",
        emphasized && "bg-carbon-800 text-sand-50 [&_*]:!text-sand-50",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p
          className={cn(
            "text-[11px] font-medium uppercase tracking-[0.14em]",
            emphasized ? "text-sand-200" : "text-tertiary",
          )}
        >
          {label}
        </p>
        {Icon && (
          <Icon
            className={cn(
              "h-4 w-4",
              emphasized ? "text-sand-300" : "text-tertiary",
            )}
          />
        )}
      </div>
      <p className="text-display text-numeric text-3xl font-medium leading-none">
        {value}
      </p>
      <div className="flex items-baseline gap-2">
        {delta && (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-xs font-medium",
              emphasized ? "text-sand-100" : deltaTone,
            )}
          >
            <Arrow className="h-3 w-3" />
            {delta.value}
          </span>
        )}
        {hint && (
          <span
            className={cn(
              "text-xs",
              emphasized ? "text-sand-200" : "text-tertiary",
            )}
          >
            {hint}
          </span>
        )}
      </div>
    </div>
  );
}
