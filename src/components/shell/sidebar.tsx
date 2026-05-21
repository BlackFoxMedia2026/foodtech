"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AREAS, findArea, type Area } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();
  const activeArea = findArea(pathname);

  return (
    <TooltipProvider delayDuration={200} skipDelayDuration={300}>
      <nav className="flex h-full flex-col items-center gap-2 px-2 py-4">
        <Link
          href="/overview"
          className="mb-2 grid h-10 w-10 place-items-center rounded-xl bg-carbon-800 text-sand-50 shadow-soft transition-transform hover:scale-[1.04]"
          aria-label="Tavolo"
        >
          <span className="font-display text-base font-medium">T</span>
        </Link>

        <span aria-hidden className="my-1 h-px w-6 bg-border" />

        <div className="flex flex-1 flex-col items-center gap-1">
          {AREAS.map((area) => (
            <RailLink key={area.key} area={area} active={activeArea?.key === area.key} />
          ))}
        </div>
      </nav>
    </TooltipProvider>
  );
}

function RailLink({ area, active }: { area: Area; active: boolean }) {
  const Icon = area.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={area.primary}
          className={cn(
            "group relative grid h-10 w-10 place-items-center rounded-xl transition-colors",
            active
              ? "bg-carbon-800 text-sand-50 shadow-soft"
              : "text-tertiary hover:bg-secondary hover:text-foreground",
          )}
          aria-label={area.label}
          aria-current={active ? "page" : undefined}
        >
          <Icon className="h-[18px] w-[18px]" />
          {active && (
            <span
              aria-hidden
              className="absolute -left-2 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-gilt"
            />
          )}
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right" align="center">
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">{area.label}</span>
          <span className="text-[10.5px] text-sand-50/55">
            {area.items.length} moduli · ⌘K per cercare
          </span>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
