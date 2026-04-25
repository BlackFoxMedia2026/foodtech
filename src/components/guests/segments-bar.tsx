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
    <div className="flex flex-wrap items-center gap-2">
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
              "rounded-full border px-3 py-1 text-xs transition",
              isActive
                ? "border-gilt bg-gilt/10 text-gilt-dark"
                : "border-border text-muted-foreground hover:bg-secondary",
            )}
          >
            {s.label}
            {typeof counts[s.key] === "number" && (
              <span className="ml-1.5 opacity-60">{counts[s.key]}</span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
