import Link from "next/link";
import { cn } from "@/lib/utils";
import { SEGMENT_DEFS, type SegmentKey } from "@/server/segments";

export function SegmentsBar({
  active,
  counts,
  query,
}: {
  active: SegmentKey;
  counts: Partial<Record<SegmentKey, number>>;
  query?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {SEGMENT_DEFS.map((s) => {
        const sp = new URLSearchParams();
        if (s.key !== "all") sp.set("segment", s.key);
        if (query) sp.set("q", query);
        const href = `/guests${sp.size ? `?${sp.toString()}` : ""}`;
        const isActive = s.key === active;
        return (
          <Link
            key={s.key}
            href={href}
            title={s.description}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
              isActive
                ? "bg-foreground text-background"
                : "bg-secondary/60 text-secondary hover:bg-secondary hover:text-foreground",
            )}
          >
            {s.label}
            {typeof counts[s.key] === "number" && (
              <span
                className={cn(
                  "rounded-full px-1.5 text-[10.5px] text-numeric",
                  isActive ? "bg-background/15" : "bg-background/60 text-tertiary",
                )}
              >
                {counts[s.key]}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
