import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  Calendar,
  CreditCard,
  KeyRound,
  MessageSquare,
  PhoneMissed,
  ShieldAlert,
  Sparkles,
  Star,
  Wifi,
  Zap,
} from "lucide-react";
import { getActiveVenue } from "@/lib/tenant";
import { listNotifications, unreadCount } from "@/server/notifications";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ReadAllButton } from "@/components/notifications/read-all-button";
import { MarkReadButton } from "@/components/notifications/mark-read-button";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  BOOKING_CREATED: "Prenotazione",
  BOOKING_CANCELLED: "Cancellazione",
  NPS_DETRACTOR: "NPS detrattore",
  WAITLIST_ACCEPTED: "Waitlist",
  CONNECTOR_INBOUND: "Channel manager",
  POS_INBOUND: "POS",
  AUTOMATION_FAILED: "Automation",
  GIFT_CARD_REDEEMED: "Gift card",
  WIFI_LEAD: "Wi-Fi lead",
  CHAT_HANDOFF: "Chat handoff",
  MISSED_CALL: "Voice",
  REVIEW_RECEIVED: "Recensione",
  PLAN_LIMIT: "Piano",
  GDPR_ANONYMIZE: "GDPR",
  PAYMENT_REFUND: "Rimborso",
  AUTH_RECOVERY_LOW: "Sicurezza",
  CONNECTOR_ERROR: "Channel manager",
  VIP_UNASSIGNED: "VIP",
};

// Kinds qualified as "critical" — used by the Critiche filter pill and
// by the icon row to give them a stronger badge tone.
const CRITICAL = new Set([
  "NPS_DETRACTOR",
  "AUTOMATION_FAILED",
  "CONNECTOR_ERROR",
  "PLAN_LIMIT",
  "PAYMENT_REFUND",
  "VIP_UNASSIGNED",
  "AUTH_RECOVERY_LOW",
]);

const ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  BOOKING_CREATED: Calendar,
  BOOKING_CANCELLED: Calendar,
  NPS_DETRACTOR: AlertTriangle,
  WAITLIST_ACCEPTED: Sparkles,
  CONNECTOR_INBOUND: Zap,
  POS_INBOUND: CreditCard,
  AUTOMATION_FAILED: AlertTriangle,
  GIFT_CARD_REDEEMED: Sparkles,
  WIFI_LEAD: Wifi,
  CHAT_HANDOFF: MessageSquare,
  MISSED_CALL: PhoneMissed,
  REVIEW_RECEIVED: Star,
  PLAN_LIMIT: AlertTriangle,
  GDPR_ANONYMIZE: ShieldAlert,
  PAYMENT_REFUND: CreditCard,
  AUTH_RECOVERY_LOW: KeyRound,
  CONNECTOR_ERROR: AlertTriangle,
  VIP_UNASSIGNED: Sparkles,
};

type Filter = "all" | "unread" | "critical";

function resolveFilter(value: string | undefined): Filter {
  if (value === "unread") return "unread";
  if (value === "critical") return "critical";
  return "all";
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: { filter?: string; unread?: string };
}) {
  const ctx = await getActiveVenue();
  // Backwards-compat: old links used ?unread=1. New canonical query param is
  // ?filter=unread|critical (or omitted).
  const filter: Filter = searchParams.filter
    ? resolveFilter(searchParams.filter)
    : searchParams.unread === "1"
      ? "unread"
      : "all";

  const [allItems, unread] = await Promise.all([
    // We fetch the union and filter in memory: only the manager-facing page,
    // bounded at 200 rows max — well within the prune window.
    listNotifications(ctx.venueId, {
      limit: 200,
      unreadOnly: filter === "unread",
    }),
    unreadCount(ctx.venueId),
  ]);

  const items =
    filter === "critical" ? allItems.filter((n) => CRITICAL.has(n.kind)) : allItems;

  const total = allItems.length;

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Operations</p>
          <h1 className="flex items-center gap-2 text-display text-3xl">
            <Bell className="h-7 w-7" /> Notifiche
          </h1>
          <p className="text-sm text-muted-foreground">
            {total} {total === 1 ? "evento" : "eventi"} · {unread}{" "}
            {unread === 1 ? "non letta" : "non lette"}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FilterPill href="/notifications" label="Tutte" active={filter === "all"} />
          <FilterPill
            href="/notifications?filter=unread"
            label={`Non lette${unread > 0 ? ` (${unread})` : ""}`}
            active={filter === "unread"}
          />
          <FilterPill
            href="/notifications?filter=critical"
            label="Critiche"
            active={filter === "critical"}
          />
          {unread > 0 && <ReadAllButton />}
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Eventi recenti</CardTitle>
          <CardDescription>
            Prenotazioni, NPS critici, automation, rimborsi, GDPR, limiti del piano e
            altri eventi che richiedono attenzione.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
              Nessuna notifica.
            </p>
          ) : (
            <ul className="divide-y text-sm">
              {items.map((n) => {
                const IconCmp = ICON[n.kind] ?? Bell;
                const critical = CRITICAL.has(n.kind);
                return (
                  <li key={n.id} className="flex items-start justify-between gap-3 py-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span
                        className={
                          critical
                            ? "mt-0.5 grid h-8 w-8 flex-none place-items-center rounded-full bg-rose-100 text-rose-700"
                            : "mt-0.5 grid h-8 w-8 flex-none place-items-center rounded-full bg-secondary text-foreground"
                        }
                      >
                        <IconCmp className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium">
                          {n.title}
                          {!n.readAt && (
                            <span className="ml-2 inline-block h-2 w-2 rounded-full bg-destructive" />
                          )}
                        </p>
                        {n.body && (
                          <p className="line-clamp-2 max-w-prose text-xs text-muted-foreground">
                            {n.body}
                          </p>
                        )}
                        <p className="text-[11px] text-muted-foreground">
                          {formatDateTime(n.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-none items-center gap-2">
                      <Badge tone={critical ? "danger" : "neutral"}>
                        {KIND_LABEL[n.kind] ?? n.kind}
                      </Badge>
                      {n.link && (
                        <Link
                          href={n.link}
                          className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                        >
                          Apri
                        </Link>
                      )}
                      {!n.readAt && <MarkReadButton id={n.id} />}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FilterPill({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded-full bg-foreground px-3 py-1 text-xs text-background"
          : "rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground hover:bg-secondary"
      }
    >
      {label}
    </Link>
  );
}
