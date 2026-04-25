import { db } from "@/lib/db";
import { getActiveVenue } from "@/lib/tenant";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/utils";
import { WidgetLinkCard } from "@/components/settings/widget-link-card";
import { NotificationsStatusCard } from "@/components/settings/notifications-status-card";
import { PaymentsStatusCard } from "@/components/settings/payments-status-card";
import { ShiftsEditor } from "@/components/settings/shifts-editor";
import { listShifts } from "@/server/shifts";
import { isEmailEnabled } from "@/lib/email";
import { isStripeEnabled } from "@/lib/stripe";

export const dynamic = "force-dynamic";

const ROLE_LABELS = {
  MANAGER: "Manager",
  RECEPTION: "Reception",
  WAITER: "Cameriere",
  MARKETING: "Marketing",
  READ_ONLY: "Sola lettura",
} as const;

export default async function SettingsPage() {
  const ctx = await getActiveVenue();
  const [venues, members, shifts] = await Promise.all([
    db.venue.findMany({ where: { orgId: ctx.orgId }, orderBy: { name: "asc" } }),
    db.venueMembership.findMany({
      where: { venueId: ctx.venueId },
      include: { user: true },
    }),
    listShifts(ctx.venueId),
  ]);

  return (
    <div className="space-y-6 animate-fade-in">
      <header>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Configurazione</p>
        <h1 className="text-display text-3xl">Impostazioni</h1>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Locali del gruppo</CardTitle>
            <CardDescription>{ctx.org.name} · piano {ctx.org.plan}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {venues.map((v) => (
              <div key={v.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <div>
                  <p className="font-medium">{v.name}</p>
                  <p className="text-xs text-muted-foreground">{v.city ?? ""} · {v.kind}</p>
                </div>
                {v.id === ctx.venueId && <Badge tone="gold">Attivo</Badge>}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Team</CardTitle>
            <CardDescription>Accessi al locale corrente</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8"><AvatarFallback>{initials(m.user.name ?? m.user.email)}</AvatarFallback></Avatar>
                  <div>
                    <p className="font-medium">{m.user.name ?? m.user.email}</p>
                    <p className="text-xs text-muted-foreground">{m.user.email}</p>
                  </div>
                </div>
                <Badge tone="neutral">{ROLE_LABELS[m.role]}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <WidgetLinkCard slug={ctx.venue.slug} />

      <NotificationsStatusCard
        enabled={isEmailEnabled()}
        fromAddress={process.env.RESEND_FROM ?? "Tavolo <noreply@tavolo.local>"}
        venueEmail={ctx.venue.email ?? null}
      />

      <PaymentsStatusCard
        enabled={isStripeEnabled()}
        webhookConfigured={Boolean(process.env.STRIPE_WEBHOOK_SECRET)}
        threshold={ctx.venue.depositThreshold}
        perPersonCents={ctx.venue.depositPerPersonCents}
        currency={ctx.venue.currency}
      />

      <Card>
        <CardHeader>
          <CardTitle>Turni di servizio</CardTitle>
          <CardDescription>
            Aggiungi, modifica o disattiva i turni per ogni giorno della settimana. La pubblicazione
            del widget e gli slot disponibili dipendono direttamente da qui.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ShiftsEditor initial={shifts} />
        </CardContent>
      </Card>
    </div>
  );
}
