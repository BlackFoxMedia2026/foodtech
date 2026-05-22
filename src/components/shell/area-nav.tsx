"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { findArea, isItemActive } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function AreaNav() {
  const pathname = usePathname();
  const area = findArea(pathname);

  if (!area || area.items.length <= 1) return null;

  return (
    <div className="sticky top-14 z-20 border-b border-border bg-background/85 backdrop-blur">
      <div className="flex items-center gap-2 overflow-x-auto px-5 py-2 lg:px-8 xl:px-10">
        <span className="shrink-0 pr-2 text-[10.5px] font-medium uppercase tracking-[0.16em] text-tertiary">
          {area.label}
        </span>
        <span aria-hidden className="h-4 w-px shrink-0 bg-border" />
        <div className="flex items-center gap-1">
          {area.items.map((item) => {
            const active = isItemActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "shrink-0 rounded-md px-3 py-1 text-[13px] font-medium transition-colors",
                  active
                    ? "bg-foreground text-background"
                    : "text-secondary hover:bg-secondary/60 hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
