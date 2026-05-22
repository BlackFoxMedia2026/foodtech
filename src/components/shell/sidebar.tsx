"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AREAS, findArea, type Area } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();
  const activeArea = findArea(pathname);

  return (
    <nav className="flex h-full flex-col gap-5 px-3 py-5">
      {/* Brand */}
      <Link
        href="/overview"
        className="flex items-center gap-2.5 px-2 py-1"
        aria-label="Tavolo home"
      >
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-gilt text-carbon-900 shadow-soft">
          <span className="font-display text-base font-semibold">T</span>
        </span>
        <span className="text-display text-[15px] font-semibold tracking-tight">
          Tavolo
        </span>
      </Link>

      {/* Area list — etichettata */}
      <div className="flex flex-1 flex-col gap-1">
        <p className="px-2 pb-1 text-[10px] font-medium uppercase tracking-[0.16em] text-tertiary">
          Aree
        </p>
        {AREAS.map((area) => (
          <AreaLink
            key={area.key}
            area={area}
            active={activeArea?.key === area.key}
          />
        ))}
      </div>

      {/* Footer hint Cmd+K */}
      <div className="border-t border-border/40 px-2 pt-3">
        <p className="text-[10px] leading-relaxed text-tertiary">
          Premi{" "}
          <span className="kbd">⌘</span>
          <span className="kbd">K</span>
          {" "}per cercare ovunque
        </p>
      </div>
    </nav>
  );
}

function AreaLink({ area, active }: { area: Area; active: boolean }) {
  const Icon = area.icon;
  return (
    <Link
      href={area.primary}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors",
        active
          ? "bg-gilt/10 text-foreground"
          : "text-secondary hover:bg-secondary/60 hover:text-foreground",
      )}
    >
      {/* Active gold marker on the left */}
      {active && (
        <span
          aria-hidden
          className="absolute -left-3 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-gilt shadow-[0_0_8px_rgba(201,162,90,0.6)]"
        />
      )}
      <span
        className={cn(
          "grid h-8 w-8 shrink-0 place-items-center rounded-md transition-colors",
          active
            ? "bg-gilt/15 text-gilt-light"
            : "bg-[hsl(var(--surface-sunken))]/60 text-tertiary group-hover:text-foreground",
        )}
      >
        <Icon className="h-[17px] w-[17px]" strokeWidth={1.75} />
      </span>
      <span
        className={cn(
          "flex-1 truncate font-medium",
          active ? "text-foreground" : "",
        )}
      >
        {area.label}
      </span>
      <span
        className={cn(
          "text-[10px] font-medium tabular-nums",
          active ? "text-gilt-light/70" : "text-tertiary/60",
        )}
      >
        {area.items.length}
      </span>
    </Link>
  );
}
