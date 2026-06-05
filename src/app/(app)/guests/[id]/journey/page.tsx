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
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { EmptyStateRich } from "@/components/ui/empty-state-rich";
import { getActiveVenue } from "@/lib/tenant";
import { getGuest } from "@/server/guests";
import {
  getGuestJourney,
  type JourneyEvent,
  type JourneyEventKind,
} from "@/server/guest-journey";
import { formatCurrency, initials } from "@/lib/utils";
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

// Tone map riusato dappertutto. Tono semantico = colori dark-friendly.
const META: Record<
  JourneyEventKind,
  { icon: LucideIcon; iconCls: string; dotCls: string }
> = {
  BOOKING_CREATED: {
    icon: CalendarPlus,
    iconCls: "bg-status-vip-soft text-status-vip",
    dotCls: "bg-status-vip",
  },
  BOOKING_COMPLETED: {
    icon: CalendarCheck,
    iconCls: "bg-status-confirmed-soft text-status-confirmed",
    dotCls: "bg-status-confirmed",
  },
  BOOKING_CANCELLED: {
    icon: CalendarX,
    iconCls: "bg-status-pending-soft text-status-pending",
    dotCls: "bg-status-pending",
  },
  BOOKING_NO_SHOW: {
    icon: Ban,
    iconCls: "bg-status-no-show-soft text-status-no-show",
    dotCls: "bg-status-no-show",
  },
  ORDER_PLACED: {
    icon: ShoppingBag,
    iconCls: "bg-secondary text-foreground",
    dotCls: "bg-tertiary",
  },
  MESSAGE_SENT: {
    icon: MessageSquare,
    iconCls: "bg-status-vip-soft text-status-vip",
    dotCls: "bg-status-vip",
  },
  COUPON_ISSUED: {
    icon: Ticket,
    iconCls: "bg-gilt/15 text-gilt-light",
    dotCls: "bg-gilt",
  },
  COUPON_REDEEMED: {
    icon: Ticket,
    iconCls: "bg-status-confirmed-soft text-status-confirmed",
    dotCls: "bg-status-confirmed",
  },
  LOYALTY_EARNED: {
    icon: Sparkles,
    iconCls: "bg-gilt/15 text-gilt-light",
    dotCls: "bg-gilt",
  },
  LOYALTY_REDEEMED: {
    icon: TrendingDown,
    iconCls: "bg-secondary text-foreground",
    dotCls: "bg-tertiary",
  },
  GIFT_CARD_REDEEMED: {
    icon: Gift,
    iconCls: "bg-gilt/15 text-gilt-light",
    dotCls: "bg-gilt",
  },
  WIFI_CONNECTED: {
    icon: Wifi,
    iconCls: "bg-status-vip-soft text-status-vip",
    dotCls: "bg-status-vip",
  },
  CHAT_OPENED: {
    icon: MessageCircle,
    iconCls: "bg-secondary text-foreground",
    dotCls: "bg-tertiary",
  },
  CONSENT_GRANTED: {
    icon: ShieldCheck,
    iconCls: "bg-status-confirmed-soft text-status-confirmed",
    dotCls: "bg-status-confirmed",
  },
  CONSENT_REVOKED: {
    icon: ShieldOff,
    iconCls: "bg-status-pending-soft text-status-pending",
    dotCls: "bg-status-pending",
  },
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

  // Group by day
  const groups = new Map<string, JourneyEvent[]>();
  for (const e of filtered) {
    const key = e.at.toISOString().slice(0, 10);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }
  const days = [...groups.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));

  const name = `${g.firstName} ${g.lastName ?? ""}`.trim();
  const totalCount = events.length;

  // KPI a colpo d'occhio
  const counts = events.reduce<Record<string, number>>((acc, e) => {
    acc[e.kind] = (acc[e.kind] ?? 0) + 1;
    return acc;
  }, {});
  const visits =
    (counts.BOOKING_COMPLETED ?? 0) +
    (counts.BOOKING_NO_SHOW ?? 0) +
    (counts.BOOKING_CANCELLED ?? 0);
  const messages = counts.MESSAGE_SENT ?? 0;
  const coupons = (counts.COUPON_REDEEMED ?? 0) + (counts.GIFT_CARD_REDEEMED ?? 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <Link
        href={`/guests/${g.id}`}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-secondary transition hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Scheda ospite
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14">
            <AvatarFallback className="text-display text-base">{initials(name)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-tertiary">
              CRM · Profile Lookback
            </p>
            <h1 className="text-display mt-1 text-[32px] font-medium leading-tight tracking-tight">
              Storia di {name}
            </h1>
            <p className="mt-1 text-sm text-secondary">
              <span className="text-numeric text-foreground">{totalCount}</span> eventi totali ·{" "}
              <span className="text-numeric text-foreground">{visits}</span> visite ·{" "}
              <span className="text-numeric text-foreground">{messages}</span> messaggi ·{" "}
              <span className="text-numeric text-foreground">{coupons}</span> riscatti
            </p>
          </div>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-1.5">
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
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                active
                  ? "bg-foreground text-background"
                  : "bg-secondary/60 text-secondary hover:bg-secondary hover:text-foreground",
              )}
            >
              {f.label}
              <span
                className={cn(
                  "rounded-full px-1.5 text-[10.5px] text-numeric",
                  active ? "bg-background/15" : "bg-background/60 text-tertiary",
                )}
              >
                {count}
              </span>
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <EmptyStateRich
          title="Nessun evento per questo filtro"
          description="Cambia filtro o aspetta che l'ospite generi attività. Tutto viene tracciato automaticamente: prenotazioni, ordini, messaggi, coupon."
        />
      ) : (
        <div className="space-y-5">
          {days.map(([day, items]) => (
            <Panel key={day}>
              <PanelHeader
                title={
                  <span className="text-base font-medium capitalize">
                    {new Date(day + "T00:00:00").toLocaleDateString("it-IT", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                }
                description={`${items.length} ${items.length === 1 ? "evento" : "eventi"}`}
              />
              <PanelBody className="pt-0">
                <ol className="relative space-y-3 border-l border-border pl-6">
                  {items.map((e) => {
                    const meta = META[e.kind];
                    const Icon = meta.icon;
                    return (
                      <li key={e.id} className="relative">
                        <span
                          className={cn(
                            "absolute -left-[34px] grid h-7 w-7 place-items-center rounded-full ring-4 ring-card",
                            meta.iconCls,
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <div className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-border bg-[hsl(var(--surface-sunken))]/40 px-3.5 py-2.5">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className={cn("h-1.5 w-1.5 rounded-full", meta.dotCls)} />
                              <p className="text-sm font-medium">{e.title}</p>
                            </div>
                            {e.body && (
                              <p className="mt-0.5 text-xs text-tertiary">{e.body}</p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-2 text-xs">
                            {typeof e.amountCents === "number" && (
                              <span className="text-display text-numeric text-sm font-medium">
                                {formatCurrency(e.amountCents, e.currency ?? "EUR")}
                              </span>
                            )}
                            <span className="text-numeric text-tertiary">
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
              </PanelBody>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
