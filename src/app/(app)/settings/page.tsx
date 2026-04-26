import { db } from "@/lib/db";
import { can, getActiveVenue } from "@/lib/tenant";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/utils";
import { WidgetLinkCard } from "@/components/settings/widget-link-card";
import { CalendarFeedCard } from "@/components/settings/calendar-feed-card";
import { NotificationsStatusCard } from "@/components/settings/notifications-status-card";
import { PaymentsStatusCard } from "@/components/settings/payments-status-card";
import { ShiftsEditor } from "@/components/settings/shifts-editor";
import { TemplatesCard } from "@/components/settings/templates-card";
import { IntegrationsCard } from "@/components/settings/integrations-card";
import { TeamCard } from "@/components/settings/team-card";
import { TableQrCard } from "@/components/settings/table-qr-card";
import { listShifts } from "@/server/shifts";
import { listTemplates } from "@/server/templates";
import { isEmailEnabled } from "@/lib/email";
import { isStripeEnabled } from "@/lib/stripe";
import { isMessagingEnabled, whichMessagingProvider } from "@/lib/messaging";
import { isAIEnabled, whichAIProvider } from "@/lib/ai";

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
  const [venues, members, shifts, templates, tables] = await Promise.all([
    db.venue.findMany({ where: { orgId: ctx.orgId }, orderBy: { name: "asc" } }),
    db.venueMembership.findMany({
      where: { venueId: ctx.venueId },
      include: { user: true },
    }),
    listShifts(ctx.venueId),
    listTemplates(ctx.venueId),
    db.table.findMany({
      where: { venueId: ctx.venueId, active: true },
      orderBy: { label: "asc" },
      select: { id: true, label: true, seats: true },
    }),
  ]);
  const canEditMarketing = can(ctx.role, "edit_marketing");

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

        <TeamCard
          initial={members.map((m) => ({
            id: m.id,
            userId: m.userId,
            role: m.role,
            user: { name: m.user.name, email: m.user.email },
          }))}
          selfUserId={ctx.userId}
          canEdit={can(ctx.role, "manage_venue")}
        />
      </div>

      <WidgetLinkCard slug={ctx.venue.slug} />

      {can(ctx.role, "manage_venue") && <TableQrCard tables={tables} />}

      {can(ctx.role, "manage_venue") && (
        <CalendarFeedCard
          baseUrl={
            process.env.NEXTAUTH_URL ??
            (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "")
          }
          venueSlug={ctx.venue.slug}
        />
      )}

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

      <IntegrationsCard
        twilio={{
          enabled: isMessagingEnabled(),
          smsFrom: process.env.TWILIO_FROM_SMS ?? null,
          waFrom: process.env.TWILIO_FROM_WHATSAPP ?? null,
        }}
        ai={{
          enabled: isAIEnabled(),
          provider: whichAIProvider(),
        }}
      />
      <span className="hidden">{whichMessagingProvider()}</span>

      <TemplatesCard initial={templates} canEdit={canEditMarketing} />

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
