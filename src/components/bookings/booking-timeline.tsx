import { History, Plus, Pencil, Clock3, ArrowRightLeft, Users, NotebookText, CreditCard, AlertTriangle, MailCheck, Bell, XCircle } from "lucide-react";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ICON: Record<string, React.ElementType> = {
  CREATED: Plus,
  STATUS_CHANGED: ArrowRightLeft,
  TABLE_CHANGED: Pencil,
  TIME_CHANGED: Clock3,
  PARTY_CHANGED: Users,
  NOTES_UPDATED: NotebookText,
  DEPOSIT_PAID: CreditCard,
  DEPOSIT_FAILED: AlertTriangle,
  REMINDER_SENT: Bell,
  CONFIRMATION_SENT: MailCheck,
  CANCELLED: XCircle,
};

export async function BookingTimeline({ bookingId }: { bookingId: string }) {
  const events = await db.bookingEvent.findMany({
    where: { bookingId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const actorIds = Array.from(new Set(events.map((e) => e.actorId).filter((x): x is string => Boolean(x))));
  const actors = actorIds.length
    ? await db.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const actorMap = new Map(actors.map((a) => [a.id, a]));

  if (events.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-4 w-4" /> Storico modifiche
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="relative space-y-4 border-l border-border pl-4">
          {events.map((e) => {
            const Icon = ICON[e.kind] ?? History;
            const actor = e.actorId ? actorMap.get(e.actorId) : null;
            return (
              <li key={e.id} className="relative">
                <span className="absolute -left-[22px] grid h-4 w-4 place-items-center rounded-full bg-background ring-2 ring-border">
                  <Icon className="h-2.5 w-2.5 text-muted-foreground" />
                </span>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(e.createdAt)}
                  {actor?.name || actor?.email ? ` · ${actor.name ?? actor.email}` : ""}
                </p>
                <p className="text-sm">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{e.kind}</span>
                  {e.message ? <span className="ml-2">{e.message}</span> : null}
                </p>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
