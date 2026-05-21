import { cn } from "@/lib/utils";

export function CapacityRing({
  pct,
  size = 120,
  stroke = 10,
  className,
}: {
  pct: number;
  size?: number;
  stroke?: number;
  className?: string;
}) {
  const safe = Math.max(0, Math.min(100, pct));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safe / 100) * circumference;

  const tone =
    safe >= 85
      ? "stroke-status-no-show"
      : safe >= 65
        ? "stroke-status-pending"
        : safe >= 30
          ? "stroke-gilt"
          : "stroke-status-confirmed";

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-[hsl(var(--surface-sunken))]"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn("transition-[stroke-dashoffset] duration-700 ease-out", tone)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-display text-numeric text-2xl font-medium leading-none">
          {Math.round(safe)}%
        </span>
        <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-tertiary">
          sala
        </span>
      </div>
    </div>
  );
}
