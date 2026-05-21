"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  LayoutDashboard,
  LayoutPanelLeft,
  LineChart,
  Megaphone,
  Settings,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type RailItem = { href: string; label: string; hint?: string; icon: LucideIcon };

// 6 destinazioni primarie. Tutto il resto vive in Cmd+K.
const PRIMARY: RailItem[] = [
  { href: "/overview", label: "Today", hint: "Service deck", icon: LayoutDashboard },
  { href: "/bookings", label: "Service", hint: "Prenotazioni & sala", icon: CalendarDays },
  { href: "/guests", label: "Guests", hint: "CRM ospiti", icon: Users },
  { href: "/floor", label: "Floor", hint: "Mappa sala", icon: LayoutPanelLeft },
  { href: "/campaigns", label: "Growth", hint: "Marketing & automazioni", icon: Megaphone },
  { href: "/insights", label: "Analytics", hint: "Performance", icon: LineChart },
];

const FOOTER: RailItem = {
  href: "/settings",
  label: "Impostazioni",
  icon: Settings,
};

// Mapping per riconoscere "active" anche su sottoroute (es. /automations attiva Growth)
const SECTION_PREFIXES: Record<string, string[]> = {
  "/overview": ["/overview", "/cockpit", "/portfolio"],
  "/bookings": ["/bookings", "/now", "/waitlist", "/kitchen"],
  "/guests": ["/guests", "/reviews", "/experiences"],
  "/floor": ["/floor"],
  "/campaigns": ["/campaigns", "/automations", "/coupons", "/gift-cards", "/wifi", "/chat", "/voice"],
  "/insights": ["/insights", "/finance", "/staff", "/payments", "/connectors"],
  "/settings": ["/settings"],
};

export function Sidebar() {
  const pathname = usePathname();

  function isActive(item: RailItem) {
    const prefixes = SECTION_PREFIXES[item.href] ?? [item.href];
    return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  }

  return (
    <TooltipProvider delayDuration={200} skipDelayDuration={300}>
      <nav className="flex h-full flex-col items-center gap-2 px-2 py-4">
        {/* Brand */}
        <Link
          href="/overview"
          className="mb-2 grid h-10 w-10 place-items-center rounded-xl bg-carbon-800 text-sand-50 shadow-soft transition-transform hover:scale-[1.04]"
          aria-label="Tavolo"
        >
          <span className="font-display text-base font-medium">T</span>
        </Link>

        <span aria-hidden className="my-1 h-px w-6 bg-border" />

        <div className="flex flex-1 flex-col items-center gap-1">
          {PRIMARY.map((item) => (
            <RailLink key={item.href} item={item} active={isActive(item)} />
          ))}
        </div>

        <span aria-hidden className="my-1 h-px w-6 bg-border" />

        <RailLink item={FOOTER} active={isActive(FOOTER)} />
      </nav>
    </TooltipProvider>
  );
}

function RailLink({ item, active }: { item: RailItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={item.href}
          className={cn(
            "group relative grid h-10 w-10 place-items-center rounded-xl transition-colors",
            active
              ? "bg-carbon-800 text-sand-50 shadow-soft"
              : "text-tertiary hover:bg-secondary hover:text-foreground",
          )}
          aria-label={item.label}
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
        <div className="flex items-center gap-2">
          <span className="font-medium">{item.label}</span>
          {item.hint && <span className="text-sand-50/55">· {item.hint}</span>}
          <span className="hidden text-sand-50/40 sm:inline">·</span>
          <span className="hidden items-center gap-0.5 text-sand-50/40 sm:inline-flex">
            <Sparkles className="h-2.5 w-2.5" />
            Cmd+K
          </span>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
