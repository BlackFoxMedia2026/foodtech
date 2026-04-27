import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarPlus,
  CalendarCheck,
  CalendarX,
  Ban,
  ShoppingBag,
  MessageSquare,
  Ticket,
  Sparkles,
  TrendingDown,
  Gift,
  Wifi,
  MessageCircle,
  ShieldCheck,
  ShieldOff,
  type LucideIcon,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getActiveVenue } from "@/lib/tenant";
import { getGuest } from "@/server/guests";
import {
  getGuestJourney,
  type JourneyEvent,
  type JourneyEventKind,
} from "@/server/guest-journey";
import { formatCurrency, formatDateTime, initials } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type FilterKey =
  | "all"
  | "bookings"
  | "orders"
  | "messages"
  | "coupons"
  | "loyalty"
  | "engagement";

const FILTERS: Array<{ key: FilterKey; label: string; kinds: JourneyEventKind[] | "*" }> = [
  { key: "all", label: "Tutto", kinds: "*" },
  {
    key: "bookings",
    label: "Prenotazioni",
    kinds: ["BOOKING_CREATED", "BOOKING_COMPLETED", "BOOKING_CANCELLED", "BOOKING_NO_SHOW"],
  },
  { key: "orders", label: "Ordini", kinds: ["ORDER_PLACED"] },
  { key: "messages", label: "Messaggi", kinds: ["MESSAGE_SENT"] },
  {
    key: "coupons",
    label: "Coupon & gift",
    kinds: ["COUPON_ISSUED", "COUPON_REDEEMED", "GIFT_CARD_REDEEMED"],
  },
  { key: "loyalty", label: "Loyalty", kinds: ["LOYALTY_EARNED", "LOYALTY_REDEEMED"] },
  {
    key: "engagement",
    label: "Engagement",
    kinds: ["WIFI_CONNECTED", "CHAT_OPENED", "CONSENT_GRANTED", "CONSENT_REVOKED"],
  },
];

const META: Record<
  JourneyEventKind,
  { icon: LucideIcon; tone: "neutral" | "gold" | "success" | "warning" | "danger" | "info"; ring: string }
> = {
  BOOKING_CREATED: { icon: CalendarPlus, tone: "info", ring: "ring-sky-200 bg-sky-50 text-sky-700" },
  BOOKING_COMPLETED: { icon: CalendarCheck, tone: "success", ring: "ring-emerald-200 bg-emerald-50 text-emerald-700" },
  BOOKING_CANCELLED: { icon: CalendarX, tone: "warning", ring: "ring-amber-200 bg-amber-50 text-amber-700" },
  BOOKING_NO_SHOW: { icon: Ban, tone: "danger", ring: "ring-rose-200 bg-rose-50 text-rose-700" },
  ORDER_PLACED: { icon: ShoppingBag, tone: "neutral", ring: "ring-border bg-secondary text-foreground" },
  MESSAGE_SENT: { icon: MessageSquare, tone: "info", ring: "ring-sky-200 bg-sky-50 text-sky-700" },
  COUPON_ISSUED: { icon: Ticket, tone: "gold", ring: "ring-gilt/30 bg-gilt/10 text-gilt-dark" },
  COUPON_REDEEMED: { icon: Ticket, tone: "success", ring: "ring-emerald-200 bg-emerald-50 text-emerald-700" },
  LOYALTY_EARNED: { icon: Sparkles, tone: "gold", ring: "ring-gilt/30 bg-gilt/10 text-gilt-dark" },
  LOYALTY_REDEEMED: { icon: TrendingDown, tone: "neutral", ring: "ring-border bg-secondary text-foreground" },
  GIFT_CARD_REDEEMED: { icon: Gift, tone: "gold", ring: "ring-gilt/30 bg-gilt/10 text-gilt-dark" },
  WIFI_CONNECTED: { icon: Wifi, tone: "info", ring: "ring-sky-200 bg-sky-50 text-sky-700" },
  CHAT_OPENED: { icon: MessageCircle, tone: "neutral", ring: "ring-border bg-secondary text-foreground" },
  CONSENT_GRANTED: { icon: ShieldCheck, tone: "success", ring: "ring-emerald-200 bg-emerald-50 text-emerald-700" },
  CONSENT_REVOKED: { icon: ShieldOff, tone: "warning", ring: "ring-amber-200 bg-amber-50 text-amber-700" },
};

function pickFilter(s: string | undefined): FilterKey {
  const valid = FILTERS.map((f) => f.key);
  return (valid as string[]).includes(s ?? "") ? (s as FilterKey) : "all";
}

function applyFilter(events: JourneyEvent[], key: FilterKey): JourneyEvent[] {
  const def = FILTERS.find((f) => f.key === key)!;
  if (def.kinds === "*") return events;
  const set = new Set(def.kinds);
  return events.filter((e) => set.has(e.kind));
}

export default async function GuestJourneyPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { filter?: string };
}) {
  const ctx = await getActiveVenue();
  const g = await getGuest(ctx.venueId, params.id);
  if (!g) notFound();

  const events = await getGuestJourney(ctx.venueId, params.id);
  const filter = pickFilter(searchParams.filter);
  const filtered = applyFilter(events, filter);

  // Group by day for the timeline
  const groups = new Map<string, JourneyEvent[]>();
  for (const e of filtered) {
    const key = e.at.toISOString().slice(0, 10);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }
  const days = [...groups.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));

  const name = `${g.firstName} ${g.lastName ?? ""}`.trim();
  const totalCount = events.length;

  return (
    <div className="space-y-6 animate-fade-in">
      <Button asChild variant="ghost" size="sm">
        <Link href={`/guests/${g.id}`}>
          <ArrowLeft className="h-4 w-4" /> Scheda ospite
        </Link>
      </Button>

      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12">
            <AvatarFallback>{initials(name)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">CRM</p>
            <h1 className="text-display text-3xl">Storia di {name}</h1>
            <p className="text-sm text-muted-foreground">
              {totalCount} eventi totali · ultimi {Math.min(totalCount, 200)} visualizzati
            </p>
          </div>
        </div>
      </header>

      <Card>
        <CardContent className="flex flex-wrap gap-2 p-3">
          {FILTERS.map((f) => {
            const active = f.key === filter;
            const count =
              f.kinds === "*"
                ? events.length
                : events.filter((e) => (f.kinds as JourneyEventKind[]).includes(e.kind)).length;
            return (
              <Link
                key={f.key}
                href={`/guests/${g.id}/journey${f.key === "all" ? "" : `?filter=${f.key}`}`}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background hover:bg-secondary",
                )}
              >
                {f.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[10px]",
                    active ? "bg-background/20" : "bg-secondary",
                  )}
                >
                  {count}
                </span>
              </Link>
            );
          })}
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            Nessun evento per questo filtro.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {days.map(([day, items]) => (
            <Card key={day}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {new Date(day + "T00:00:00").toLocaleDateString("it-IT", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="relative space-y-4 border-l border-border pl-6">
                  {items.map((e) => {
                    const meta = META[e.kind];
                    const Icon = meta.icon;
                    return (
                      <li key={e.id} className="relative">
                        <span
                          className={cn(
                            "absolute -left-[34px] grid h-7 w-7 place-items-center rounded-full ring-2",
                            meta.ring,
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <div className="flex flex-wrap items-start justify-between gap-2 rounded-md border bg-background px-3 py-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{e.title}</p>
                            {e.body && (
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {e.body}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {typeof e.amountCents === "number" && (
                              <Badge tone={meta.tone}>
                                {formatCurrency(e.amountCents, e.currency ?? "EUR")}
                              </Badge>
                            )}
                            <span>
                              {e.at.toLocaleTimeString("it-IT", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            {e.link && (
                              <Button asChild variant="ghost" size="sm">
                                <Link href={e.link}>Apri</Link>
                              </Button>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
