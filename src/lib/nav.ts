import {
  LayoutDashboard,
  Users,
  ShoppingBag,
  Megaphone,
  LineChart,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; hint?: string };

export type Area = {
  key: string;
  label: string;
  icon: LucideIcon;
  primary: string;
  items: NavItem[];
};

// 6 macro aree. La sidebar mostra solo queste 6.
// Ogni area espone i sotto-moduli in una secondary navigation sotto la topbar.
export const AREAS: Area[] = [
  {
    key: "oggi",
    label: "Oggi",
    icon: LayoutDashboard,
    primary: "/overview",
    items: [
      { href: "/overview", label: "Panoramica" },
      { href: "/now", label: "Sala live" },
      { href: "/bookings", label: "Prenotazioni" },
      { href: "/waitlist", label: "Lista d'attesa" },
      { href: "/kitchen", label: "Cucina" },
    ],
  },
  {
    key: "ospiti",
    label: "Ospiti",
    icon: Users,
    primary: "/guests",
    items: [
      { href: "/guests", label: "CRM" },
      { href: "/guests/insights", label: "Segmenti" },
      { href: "/reviews", label: "Recensioni" },
      { href: "/insights/feedback", label: "Sondaggi" },
    ],
  },
  {
    key: "vendite",
    label: "Vendite",
    icon: ShoppingBag,
    primary: "/orders",
    items: [
      { href: "/orders", label: "Asporto & Delivery" },
      { href: "/experiences", label: "Eventi & Ticket" },
      { href: "/payments", label: "Pagamenti" },
      { href: "/gift-cards", label: "Gift card" },
      { href: "/coupons", label: "Coupon" },
      { href: "/pos", label: "POS" },
    ],
  },
  {
    key: "growth",
    label: "Growth",
    icon: Megaphone,
    primary: "/campaigns",
    items: [
      { href: "/campaigns", label: "Campagne" },
      { href: "/automations", label: "Automazioni" },
      { href: "/wifi", label: "Wi-Fi marketing" },
      { href: "/chat", label: "Chatbot" },
      { href: "/voice", label: "Assistente vocale" },
    ],
  },
  {
    key: "analytics",
    label: "Analytics",
    icon: LineChart,
    primary: "/insights",
    items: [
      { href: "/insights", label: "Performance" },
      { href: "/cockpit", label: "Cockpit" },
      { href: "/portfolio", label: "Multi-location" },
      { href: "/finance", label: "Economico" },
      { href: "/staff/performance", label: "Staff" },
    ],
  },
  {
    key: "setup",
    label: "Setup",
    icon: SlidersHorizontal,
    primary: "/settings",
    items: [
      { href: "/settings", label: "Impostazioni" },
      { href: "/floor", label: "Sala & tavoli" },
      { href: "/menu", label: "Menu digitale" },
      { href: "/connectors", label: "Channel manager" },
    ],
  },
];

export function findArea(pathname: string): Area | null {
  // longest-match: prediligi sub-item path piu' lungo per evitare collisioni
  let best: { area: Area; len: number } | null = null;
  for (const area of AREAS) {
    for (const item of area.items) {
      if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
        if (!best || item.href.length > best.len) {
          best = { area, len: item.href.length };
        }
      }
    }
  }
  return best?.area ?? null;
}

export function isItemActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  // Solo i "primary" matchano i prefissi (evita /guests che attiva pure /guests/insights)
  // → usiamo match esatto, con eccezione per detail pages /guests/[id]
  if (href === "/guests" && pathname.startsWith("/guests/") && !pathname.startsWith("/guests/insights")) {
    return true;
  }
  if (href === "/bookings" && pathname.startsWith("/bookings/")) return true;
  if (href === "/experiences" && pathname.startsWith("/experiences/")) return true;
  if (href === "/insights" && pathname.startsWith("/insights/") && !pathname.startsWith("/insights/feedback")) {
    return true;
  }
  if (href === "/staff/performance" && pathname.startsWith("/staff/")) return true;
  return false;
}
