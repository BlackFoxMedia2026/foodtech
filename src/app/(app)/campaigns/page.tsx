import { db } from "@/lib/db";
import { getActiveVenue, can } from "@/lib/tenant";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Megaphone } from "lucide-react";
import { CampaignDialog } from "@/components/campaigns/campaign-dialog";
import { isEmailEnabled } from "@/lib/email";
import { isMessagingEnabled } from "@/lib/messaging";
import { formatDateTime } from "@/lib/utils";
import { listTemplates } from "@/server/templates";
import { messageLogStats, recentMessageLogs } from "@/server/messages";

export const dynamic = "force-dynamic";

const CHANNEL_TONE = {
  EMAIL: "info",
  SMS: "gold",
  WHATSAPP: "success",
} as const;

const STATUS_TONE = {
  DRAFT: "neutral",
  SCHEDULED: "info",
  SENT: "success",
  ARCHIVED: "neutral",
} as const;

const LOG_STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  SENT: "success",
  DELIVERED: "success",
  QUEUED: "neutral",
  SKIPPED: "warning",
  FAILED: "danger",
};

export default async function CampaignsPage() {
  const ctx = await getActiveVenue();
  const [items, templates, logs, logStats] = await Promise.all([
    db.campaign.findMany({ where: { venueId: ctx.venueId }, orderBy: { createdAt: "desc" } }),
    listTemplates(ctx.venueId),
    recentMessageLogs(ctx.venueId, 25),
    messageLogStats(ctx.venueId),
  ]);
  const canEdit = can(ctx.role, "edit_marketing");
  const emailEnabled = isEmailEnabled();
  const messagingEnabled = isMessagingEnabled();
  const tplOptions = templates.map((t) => ({
    id: t.id,
    name: t.name,
    channel: t.channel,
    subject: t.subject,
    body: t.body,
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Marketing</p>
          <h1 className="text-display text-3xl">Campagne</h1>
          <p className="text-sm text-muted-foreground">
            {items.length} campagne · {items.filter((c) => c.status === "SENT").length} inviate
          </p>
        </div>
        {canEdit && <CampaignDialog emailEnabled={emailEnabled} templates={tplOptions} />}
      </header>

      {(!emailEnabled || !messagingEnabled) && (
        <div className="space-y-2 text-sm">
          {!emailEnabled && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
              Provider email non configurato. Aggiungi{" "}
              <code className="rounded bg-amber-100 px-1">RESEND_API_KEY</code> per email reali.
            </p>
          )}
          {!messagingEnabled && (
            <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sky-800">
              SMS / WhatsApp simulati: configura il provider (es.{" "}
              <code className="rounded bg-sky-100 px-1">TWILIO_*</code>) per spedire davvero.
            </p>
          )}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.length === 0 && (
          <p className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground md:col-span-3">
            Nessuna campagna creata. Crea la prima per inviare un&apos;email a un segmento di ospiti.
          </p>
        )}
        {items.map((c) => {
          const openRate = c.sentCount > 0 ? Math.round((c.openedCount / c.sentCount) * 100) : 0;
          return (
            <Card key={c.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge tone={CHANNEL_TONE[c.channel]}>{c.channel}</Badge>
                    <Badge tone={STATUS_TONE[c.status]}>{c.status}</Badge>
                  </div>
                  {canEdit && (
                    <CampaignDialog
                      emailEnabled={emailEnabled}
                      templates={tplOptions}
                      initial={{
                        id: c.id,
                        name: c.name,
                        channel: c.channel,
                        subject: c.subject,
                        body: c.body,
                        status: c.status,
                        segment: c.segment as {
                          marketingOptInOnly?: boolean;
                          loyaltyTiers?: ("NEW" | "REGULAR" | "VIP" | "AMBASSADOR")[];
                          tags?: string[];
                        } | null,
                      }}
                    />
                  )}
                </div>
                <CardTitle className="flex items-center gap-2">
                  <Megaphone className="h-4 w-4 text-gilt-dark" />
                  {c.name}
                </CardTitle>
                {c.subject && <p className="text-sm text-muted-foreground line-clamp-1">{c.subject}</p>}
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-3 gap-3">
                  <Metric label="Inviate" value={c.sentCount} />
                  <Metric label="Aperte" value={`${openRate}%`} />
                  <Metric label="Prenotazioni" value={c.bookedCount} />
                </div>
                {c.scheduledAt && c.status === "SENT" && (
                  <p className="text-xs text-muted-foreground">
                    Inviata il {formatDateTime(c.scheduledAt)}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registro messaggi</CardTitle>
          <CardDescription>
            Ultimi 25 invii (campagne + automazioni). Stato per audit GDPR e troubleshooting.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
            {logStats.length === 0 ? (
              <span>Ancora nessun invio negli ultimi 30 giorni.</span>
            ) : (
              logStats.map((s, i) => (
                <span
                  key={`${s.channel}-${s.status}-${i}`}
                  className="rounded-full border px-2 py-0.5"
                >
                  {s.channel} · {s.status}: {s.count}
                </span>
              ))
            )}
          </div>
          {logs.length === 0 ? (
            <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              Nessun messaggio in coda. Crea una campagna o attiva un&apos;automazione per popolare questo log.
            </p>
          ) : (
            <ul className="divide-y text-sm">
              {logs.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      <Badge tone={CHANNEL_TONE[m.channel]}>{m.channel}</Badge>{" "}
                      <span className="ml-2">{m.toAddress}</span>
                      {m.guest && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {m.guest.firstName}
                          {m.guest.lastName ? ` ${m.guest.lastName}` : ""}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {m.campaign?.name ? `${m.campaign.name} · ` : ""}
                      {m.subject ?? m.bodyPreview ?? "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {m.error && <span className="text-amber-700">{m.error}</span>}
                    <Badge tone={LOG_STATUS_TONE[m.status] ?? "neutral"}>{m.status}</Badge>
                    <span className="text-muted-foreground">{formatDateTime(m.createdAt)}</span>
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

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-display text-xl">{value}</p>
    </div>
  );
}
