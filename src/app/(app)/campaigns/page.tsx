import { db } from "@/lib/db";
import { getActiveVenue, can } from "@/lib/tenant";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Stat } from "@/components/ui/stat";
import { EmptyStateRich } from "@/components/ui/empty-state-rich";
import { Megaphone } from "lucide-react";
import { CampaignDialog } from "@/components/campaigns/campaign-dialog";
import { isEmailEnabled } from "@/lib/email";
import { isMessagingEnabled } from "@/lib/messaging";
import { formatDateTime } from "@/lib/utils";
import { listTemplates } from "@/server/templates";
import { messageLogStats, recentMessageLogs } from "@/server/messages";
import { ExportButton } from "@/components/ui/export-button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const CHANNEL_META: Record<string, { label: string; tone: string }> = {
  EMAIL: { label: "Email", tone: "bg-status-vip-soft text-status-vip" },
  SMS: { label: "SMS", tone: "bg-gilt/15 text-gilt-light" },
  WHATSAPP: { label: "WhatsApp", tone: "bg-status-confirmed-soft text-status-confirmed" },
};

const CAMPAIGN_STATUS_META: Record<string, { label: string; tone: string }> = {
  DRAFT: { label: "Bozza", tone: "bg-secondary text-secondary" },
  SCHEDULED: { label: "Pianificata", tone: "bg-status-vip-soft text-status-vip" },
  SENT: { label: "Inviata", tone: "bg-status-confirmed-soft text-status-confirmed" },
  ARCHIVED: { label: "Archiviata", tone: "bg-secondary text-secondary" },
};

const LOG_STATUS_META: Record<string, { label: string; tone: string }> = {
  SENT: { label: "Inviato", tone: "bg-status-confirmed-soft text-status-confirmed" },
  DELIVERED: { label: "Consegnato", tone: "bg-status-confirmed-soft text-status-confirmed" },
  QUEUED: { label: "In coda", tone: "bg-secondary text-secondary" },
  SKIPPED: { label: "Saltato", tone: "bg-status-pending-soft text-status-pending" },
  FAILED: { label: "Errore", tone: "bg-status-no-show-soft text-status-no-show" },
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

  const sent = items.filter((c) => c.status === "SENT").length;
  const scheduled = items.filter((c) => c.status === "SCHEDULED").length;
  const draft = items.filter((c) => c.status === "DRAFT").length;
  const totalSent = items.reduce((s, c) => s + c.sentCount, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-tertiary">
            Growth · Marketing
          </p>
          <h1 className="text-display mt-1 text-[34px] font-medium leading-tight tracking-tight">
            Campagne
          </h1>
          <p className="mt-1 text-sm text-secondary">
            Email, SMS e WhatsApp segmentati ai tuoi ospiti. Compila in 3 step:
            pubblico, messaggio, invio.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && <ExportButton kind="messages" label="Registro CSV" />}
          {canEdit && <CampaignDialog emailEnabled={emailEnabled} templates={tplOptions} />}
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        <Stat label="Totali" value={items.length} hint="dall'inizio" emphasized />
        <Stat label="Inviate" value={sent} hint="campagne chiuse" />
        <Stat label="Pianificate" value={scheduled} hint="in partenza" />
        <Stat label="Messaggi totali" value={totalSent} hint="invii a destinatari" />
      </section>

      {(!emailEnabled || !messagingEnabled) && (
        <div className="space-y-2 text-sm">
          {!emailEnabled && (
            <div className="rounded-xl border border-status-pending/30 bg-status-pending-soft/40 px-3.5 py-2.5">
              <p className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-status-pending">
                Provider email non configurato
              </p>
              <p className="mt-0.5 text-status-pending">
                Aggiungi{" "}
                <code className="rounded bg-status-pending/15 px-1.5 py-0.5 font-mono text-xs">
                  RESEND_API_KEY
                </code>{" "}
                in env per spedire email reali.
              </p>
            </div>
          )}
          {!messagingEnabled && (
            <div className="rounded-xl border border-status-vip/30 bg-status-vip-soft/40 px-3.5 py-2.5">
              <p className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-status-vip">
                SMS / WhatsApp simulati
              </p>
              <p className="mt-0.5 text-status-vip">
                Configura il provider (es.{" "}
                <code className="rounded bg-status-vip/15 px-1.5 py-0.5 font-mono text-xs">
                  TWILIO_*
                </code>
                ) per spedire davvero.
              </p>
            </div>
          )}
        </div>
      )}

      {items.length === 0 ? (
        <EmptyStateRich
          icon={Megaphone}
          title="Nessuna campagna creata"
          description="Crea la prima campagna per inviare email/SMS/WhatsApp a un segmento di ospiti. Composer guidato in 3 step."
          primary={
            canEdit && (
              <CampaignDialog emailEnabled={emailEnabled} templates={tplOptions} />
            )
          }
          hint="Le campagne sono integrate con CRM, segmenti e automazioni."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((c) => {
            const openRate =
              c.sentCount > 0 ? Math.round((c.openedCount / c.sentCount) * 100) : 0;
            const channelMeta = CHANNEL_META[c.channel] ?? {
              label: c.channel,
              tone: "bg-secondary text-secondary",
            };
            const statusMeta = CAMPAIGN_STATUS_META[c.status] ?? {
              label: c.status,
              tone: "bg-secondary text-secondary",
            };
            return (
              <Panel key={c.id}>
                <PanelHeader
                  title={
                    <span className="flex items-center gap-2">
                      <Megaphone className="h-4 w-4 text-tertiary" /> {c.name}
                    </span>
                  }
                  description={c.subject ?? undefined}
                  action={
                    canEdit ? (
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
                            loyaltyTiers?: (
                              | "NEW"
                              | "REGULAR"
                              | "VIP"
                              | "AMBASSADOR"
                            )[];
                            tags?: string[];
                          } | null,
                        }}
                      />
                    ) : null
                  }
                />
                <PanelBody className="space-y-3 pt-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10.5px] font-medium",
                        channelMeta.tone,
                      )}
                    >
                      {channelMeta.label}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10.5px] font-medium",
                        statusMeta.tone,
                      )}
                    >
                      {statusMeta.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <Metric label="Inviate" value={c.sentCount} />
                    <Metric label="Aperture" value={`${openRate}%`} />
                    <Metric label="Prenot." value={c.bookedCount} />
                  </div>

                  {c.scheduledAt && c.status === "SENT" && (
                    <p className="text-[11px] text-tertiary">
                      Inviata il {formatDateTime(c.scheduledAt)}
                    </p>
                  )}
                </PanelBody>
              </Panel>
            );
          })}
        </div>
      )}

      <Panel>
        <PanelHeader
          title="Registro messaggi"
          description="Ultimi 25 invii (campagne + automazioni). Stato per audit GDPR e troubleshooting."
        />
        <PanelBody className="pt-0">
          {logStats.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {logStats.map((s, i) => (
                <span
                  key={`${s.channel}-${s.status}-${i}`}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-[hsl(var(--surface-sunken))]/40 px-2.5 py-0.5 text-[10.5px] font-medium"
                >
                  <span className="text-tertiary">{s.channel}</span>
                  <span className="text-tertiary">·</span>
                  <span>{s.status}</span>
                  <span className="text-numeric text-tertiary">{s.count}</span>
                </span>
              ))}
            </div>
          )}
          {logs.length === 0 ? (
            <p className="text-sm text-tertiary">
              Nessun messaggio in coda. Crea una campagna o attiva un&apos;automazione per popolare il log.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {logs.map((m) => {
                const channelMeta = CHANNEL_META[m.channel] ?? {
                  label: m.channel,
                  tone: "bg-secondary text-secondary",
                };
                const statusMeta = LOG_STATUS_META[m.status] ?? {
                  label: m.status,
                  tone: "bg-secondary text-secondary",
                };
                return (
                  <li
                    key={m.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-medium",
                            channelMeta.tone,
                          )}
                        >
                          {channelMeta.label}
                        </span>
                        <span className="truncate font-medium">{m.toAddress}</span>
                        {m.guest && (
                          <span className="text-xs text-tertiary">
                            {m.guest.firstName}
                            {m.guest.lastName ? ` ${m.guest.lastName}` : ""}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-tertiary line-clamp-1">
                        {m.campaign?.name ? `${m.campaign.name} · ` : ""}
                        {m.subject ?? m.bodyPreview ?? "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      {m.error && (
                        <span className="text-status-no-show">{m.error}</span>
                      )}
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-medium",
                          statusMeta.tone,
                        )}
                      >
                        {statusMeta.label}
                      </span>
                      <span className="text-tertiary text-numeric">
                        {formatDateTime(m.createdAt)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </PanelBody>
      </Panel>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="panel-sunken px-2 py-2">
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-tertiary">
        {label}
      </p>
      <p className="text-display text-numeric mt-1 text-lg font-medium leading-none tabular-nums">
        {value}
      </p>
    </div>
  );
}
