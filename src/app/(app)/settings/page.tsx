import { db } from "@/lib/db";
import { can, getActiveVenue } from "@/lib/tenant";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { VenuesCard, type VenueRow } from "@/components/settings/venues-card";
import { SecurityCard } from "@/components/settings/security-card";
import { WidgetLinkCard } from "@/components/settings/widget-link-card";
import { CalendarFeedCard } from "@/components/settings/calendar-feed-card";
import { NotificationsStatusCard } from "@/components/settings/notifications-status-card";
import { PaymentsStatusCard } from "@/components/settings/payments-status-card";
import { ShiftsEditor } from "@/components/settings/shifts-editor";
import { TemplatesCard } from "@/components/settings/templates-card";
import { IntegrationsCard } from "@/components/settings/integrations-card";
import { TeamCard } from "@/components/settings/team-card";
import { TableQrCard } from "@/components/settings/table-qr-card";
import { BrandingCard } from "@/components/settings/branding-card";
import { ApiTokensCard } from "@/components/settings/api-tokens-card";
import { SubscriptionCard } from "@/components/settings/subscription-card";
import { ReportingCurrencyCard } from "@/components/settings/reporting-currency-card";
import { getPlanLimits, type PlanName } from "@/lib/plan-limits";
import { getVenueBrandById } from "@/server/branding";
import { listShifts } from "@/server/shifts";
import { listTemplates } from "@/server/templates";
import { isEmailEnabled } from "@/lib/email";
import { isStripeEnabled } from "@/lib/stripe";
import { isMessagingEnabled, whichMessagingProvider } from "@/lib/messaging";
import { isAIEnabled, whichAIProvider } from "@/lib/ai";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const ctx = await getActiveVenue();
  const since30d = new Date(Date.now() - 30 * 86400_000);
  const [
    venues,
    members,
    shifts,
    templates,
    tables,
    brand,
    activeAutomations,
    campaignsLast30d,
    me,
    org,
  ] = await Promise.all([
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
    getVenueBrandById(ctx.venueId),
    db.automationWorkflow.count({ where: { venueId: ctx.venueId, active: true } }),
    db.campaign.count({ where: { venueId: ctx.venueId, createdAt: { gte: since30d } } }),
    db.user.findUnique({
      where: { id: ctx.userId },
      select: { totpEnabled: true },
    }),
    db.organization.findUnique({
      where: { id: ctx.orgId },
      select: { baseCurrency: true },
    }),
  ]);
  const canEditMarketing = can(ctx.role, "edit_marketing");

  const plan = ctx.org.plan as PlanName;
  const limits = getPlanLimits(plan);
  const usage = [
    { label: "Venues", used: venues.length, max: limits.maxVenues, hint: "Per organizzazione" },
    { label: "Staff", used: members.length, max: limits.maxStaffPerVenue, hint: "Locale corrente" },
    {
      label: "Automazioni",
      used: activeAutomations,
      max: limits.maxActiveAutomations,
      hint: "Attive",
    },
    {
      label: "Campagne 30gg",
      used: campaignsLast30d,
      max: limits.maxCampaignsPerMonth,
      hint: "Create negli ultimi 30 giorni",
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <header>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Configurazione</p>
        <h1 className="text-display text-3xl">Impostazioni</h1>
      </header>

      <SubscriptionCard plan={plan} usage={usage} />

      <ReportingCurrencyCard
        initial={org?.baseCurrency ?? "EUR"}
        canEdit={can(ctx.role, "manage_venue")}
      />

      <SecurityCard initialEnabled={me?.totpEnabled ?? false} />

      <div className="grid gap-6 lg:grid-cols-2">
        <VenuesCard
          initial={venues.map<VenueRow>((v) => ({
            id: v.id,
            name: v.name,
            city: v.city,
            address: v.address,
            country: v.country,
            phone: v.phone,
            email: v.email,
            kind: v.kind,
            active: v.active,
          }))}
          activeVenueId={ctx.venueId}
          canEdit={can(ctx.role, "manage_venue")}
          orgName={ctx.org.name}
          plan={ctx.org.plan}
        />

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

      {can(ctx.role, "manage_venue") && (
        <BrandingCard
          initial={
            brand
              ? { logoUrl: brand.logoUrl, accent: brand.accent, footnote: brand.footnote }
              : null
          }
        />
      )}

      {can(ctx.role, "manage_venue") && <TableQrCard tables={tables} />}

      {can(ctx.role, "manage_venue") && <ApiTokensCard />}

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
