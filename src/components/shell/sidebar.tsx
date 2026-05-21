"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarRange,
  LayoutPanelLeft,
  Users,
  Megaphone,
  Sparkles,
  CreditCard,
  LineChart,
  Settings,
  Tv,
  Building2,
  Hourglass,
  BookOpen,
  ShoppingBag,
  Wifi,
  Ticket,
  Workflow,
  MessagesSquare,
  PhoneCall,
  PiggyBank,
  TrendingUp,
  Network,
  Gauge,
  Gift,
  ChefHat,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard };
type NavGroup = { label: string; items: NavItem[] };

const GROUPS: NavGroup[] = [
  {
    label: "Oggi",
    items: [
      { href: "/overview", label: "Panoramica", icon: LayoutDashboard },
      { href: "/now", label: "Sala live", icon: Tv },
      { href: "/bookings", label: "Prenotazioni", icon: CalendarRange },
      { href: "/waitlist", label: "Lista d'attesa", icon: Hourglass },
      { href: "/kitchen", label: "Cucina", icon: ChefHat },
    ],
  },
  {
    label: "Ospiti",
    items: [
      { href: "/guests", label: "CRM", icon: Users },
      { href: "/experiences", label: "Esperienze", icon: Sparkles },
      { href: "/reviews", label: "Recensioni", icon: Star },
    ],
  },
  {
    label: "Gestione",
    items: [
      { href: "/floor", label: "Sala", icon: LayoutPanelLeft },
      { href: "/menu", label: "Menu", icon: BookOpen },
      { href: "/orders", label: "Asporto", icon: ShoppingBag },
      { href: "/pos", label: "POS", icon: CreditCard },
    ],
  },
  {
    label: "Growth",
    items: [
      { href: "/campaigns", label: "Campagne", icon: Megaphone },
      { href: "/automations", label: "Automazioni", icon: Workflow },
      { href: "/coupons", label: "Coupon", icon: Ticket },
      { href: "/gift-cards", label: "Gift card", icon: Gift },
      { href: "/wifi", label: "Wi-Fi", icon: Wifi },
      { href: "/chat", label: "Chatbot", icon: MessagesSquare },
      { href: "/voice", label: "Assistente vocale", icon: PhoneCall },
    ],
  },
  {
    label: "Analytics",
    items: [
      { href: "/cockpit", label: "Cockpit", icon: Gauge },
      { href: "/portfolio", label: "Portfolio", icon: Building2 },
      { href: "/insights", label: "Performance", icon: LineChart },
      { href: "/finance", label: "Economico", icon: PiggyBank },
      { href: "/staff/performance", label: "Staff", icon: TrendingUp },
      { href: "/payments", label: "Pagamenti", icon: CreditCard },
      { href: "/connectors", label: "Channel manager", icon: Network },
    ],
  },
];

const FOOTER_ITEM: NavItem = {
  href: "/settings",
  label: "Impostazioni",
  icon: Settings,
};

export function Sidebar() {
  const pathname = usePathname();

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <nav className="flex h-full flex-col gap-5 px-3 py-5">
      <Link
        href="/overview"
        className="mb-1 flex items-center gap-2 rounded-md px-2 py-1 text-display text-base font-semibold tracking-tight"
      >
        <span className="grid h-7 w-7 place-items-center rounded-md bg-carbon-800 text-sand-50">
          <span className="font-display text-sm">T</span>
        </span>
        Tavolo
      </Link>

      <div className="flex-1 space-y-5 overflow-y-auto pr-1">
        {GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-2 pb-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-tertiary">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = isActive(href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      className={cn(
                        "group flex items-center gap-3 rounded-md px-2 py-1.5 text-[13px] transition-colors",
                        active
                          ? "bg-secondary text-foreground"
                          : "text-secondary hover:bg-secondary/60 hover:text-foreground",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          active ? "text-foreground" : "text-tertiary",
                        )}
                      />
                      <span className="truncate">{label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <Link
        href={FOOTER_ITEM.href}
        className={cn(
          "flex items-center gap-3 rounded-md px-2 py-1.5 text-[13px] transition-colors",
          isActive(FOOTER_ITEM.href)
            ? "bg-secondary text-foreground"
            : "text-secondary hover:bg-secondary/60 hover:text-foreground",
        )}
      >
        <FOOTER_ITEM.icon className="h-4 w-4 text-tertiary" />
        {FOOTER_ITEM.label}
      </Link>
    </nav>
  );
}
