"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { AREAS, findArea, isItemActive, type Area } from "@/lib/nav";
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

      {/* Area list — etichettata, sub-items espandibili sotto l'area attiva */}
      <div className="flex flex-1 flex-col gap-1 overflow-y-auto pr-1">
        <p className="px-2 pb-1 text-[10px] font-medium uppercase tracking-[0.16em] text-tertiary">
          Aree
        </p>
        {AREAS.map((area) => (
          <AreaBlock
            key={area.key}
            area={area}
            active={activeArea?.key === area.key}
            pathname={pathname}
          />
        ))}
      </div>

      {/* Footer hint Cmd+K */}
      <div className="border-t border-border/40 px-2 pt-3">
        <p className="text-[10px] leading-relaxed text-tertiary">
          Premi <span className="kbd">⌘</span>
          <span className="kbd">K</span> per cercare ovunque
        </p>
      </div>
    </nav>
  );
}

function AreaBlock({
  area,
  active,
  pathname,
}: {
  area: Area;
  active: boolean;
  pathname: string;
}) {
  const Icon = area.icon;
  return (
    <div className="flex flex-col">
      <Link
        href={area.primary}
        aria-current={active ? "page" : undefined}
        aria-expanded={active}
        className={cn(
          "group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors",
          active
            ? "bg-gilt/10 text-foreground"
            : "text-secondary hover:bg-secondary/60 hover:text-foreground",
        )}
      >
        {/* Active gold marker */}
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
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 transition-transform",
            active ? "rotate-0 text-tertiary" : "-rotate-90 text-tertiary/50",
          )}
          aria-hidden
        />
      </Link>

      {/* Sub-items — visibili solo quando l'area è attiva */}
      {active && (
        <ul className="ml-[26px] mt-1 flex flex-col gap-0.5 border-l border-border/50 pl-2.5 animate-fade-in">
          {area.items.map((item) => {
            const subActive = isItemActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={subActive ? "page" : undefined}
                  className={cn(
                    "relative flex items-center rounded-md px-2.5 py-1.5 text-[12.5px] transition-colors",
                    subActive
                      ? "bg-foreground/[0.06] font-semibold text-foreground"
                      : "text-secondary hover:text-foreground",
                  )}
                >
                  {/* mini active dot sull'item attivo */}
                  {subActive && (
                    <span
                      aria-hidden
                      className="absolute -left-[15px] top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-gilt"
                    />
                  )}
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
