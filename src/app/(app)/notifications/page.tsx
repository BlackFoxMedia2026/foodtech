import Link from "next/link";
import { Bell } from "lucide-react";
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
};

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: { unread?: string };
}) {
  const ctx = await getActiveVenue();
  const unreadOnly = searchParams.unread === "1";
  const [items, unread] = await Promise.all([
    listNotifications(ctx.venueId, { limit: 100, unreadOnly }),
    unreadCount(ctx.venueId),
  ]);

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Operations</p>
          <h1 className="flex items-center gap-2 text-display text-3xl">
            <Bell className="h-7 w-7" /> Notifiche
          </h1>
          <p className="text-sm text-muted-foreground">
            {unread} {unread === 1 ? "non letta" : "non lette"} · ultimi 100 eventi del locale.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/notifications"
            className={
              !unreadOnly
                ? "rounded-full bg-foreground px-3 py-1 text-xs text-background"
                : "rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground hover:bg-secondary"
            }
          >
            Tutte
          </Link>
          <Link
            href="/notifications?unread=1"
            className={
              unreadOnly
                ? "rounded-full bg-foreground px-3 py-1 text-xs text-background"
                : "rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground hover:bg-secondary"
            }
          >
            Solo non lette
          </Link>
          {unread > 0 && <ReadAllButton />}
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Eventi recenti</CardTitle>
          <CardDescription>
            Gli eventi più importanti del locale: prenotazioni, automation falliti, NPS critici,
            offerte waitlist accettate, vendite POS, recensioni.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
              Nessuna notifica.
            </p>
          ) : (
            <ul className="divide-y text-sm">
              {items.map((n) => (
                <li key={n.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {n.title}
                      {!n.readAt && <span className="ml-2 inline-block h-2 w-2 rounded-full bg-destructive" />}
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
                  <div className="flex items-center gap-2">
                    <Badge tone="neutral">{KIND_LABEL[n.kind] ?? n.kind}</Badge>
                    {n.link && (
                      <Link
                        href={n.link}
                        className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                      >
                        Apri
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
