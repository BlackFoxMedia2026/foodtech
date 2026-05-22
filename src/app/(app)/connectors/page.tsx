import { Network } from "lucide-react";
import { getActiveVenue, can } from "@/lib/tenant";
import {
  connectorStats,
  listConnectorEvents,
  listConnectors,
} from "@/server/connectors";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Stat } from "@/components/ui/stat";
import { EmptyStateRich } from "@/components/ui/empty-state-rich";
import { ConnectorDialog } from "@/components/connectors/connector-dialog";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  THEFORK: "TheFork",
  GOOGLE_RESERVE: "Google Reserve",
  BOOKING_COM: "Booking.com",
  OPENTABLE: "OpenTable",
  CUSTOM: "Webhook custom",
};

const STATUS_META: Record<string, { label: string; tone: string }> = {
  ACTIVE: { label: "Attivo", tone: "bg-status-confirmed-soft text-status-confirmed" },
  PAUSED: { label: "In pausa", tone: "bg-status-pending-soft text-status-pending" },
  ERROR: { label: "Errore", tone: "bg-status-no-show-soft text-status-no-show" },
  DRAFT: { label: "Bozza", tone: "bg-secondary text-secondary" },
};

const EVENT_META: Record<string, { label: string; tone: string }> = {
  PROCESSED: { label: "OK", tone: "bg-status-confirmed-soft text-status-confirmed" },
  RECEIVED: { label: "Ricevuto", tone: "bg-secondary text-secondary" },
  REJECTED: { label: "Scartato", tone: "bg-status-pending-soft text-status-pending" },
  FAILED: { label: "Errore", tone: "bg-status-no-show-soft text-status-no-show" },
};

export default async function ConnectorsPage() {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "manage_venue")) {
    return (
      <EmptyStateRich
        icon={Network}
        title="Accesso riservato al Manager"
        description="Solo i Manager possono configurare i connettori esterni."
      />
    );
  }
  const baseUrl =
    process.env.NEXTAUTH_URL ||
    `https://${process.env.VERCEL_URL || "localhost:3000"}`;

  const [items, events, stats] = await Promise.all([
    listConnectors(ctx.venueId),
    listConnectorEvents(ctx.venueId, 30),
    connectorStats(ctx.venueId),
  ]);

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-tertiary">
            Setup · Canali esterni
          </p>
          <h1 className="text-display mt-1 text-[34px] font-medium leading-tight tracking-tight">
            Channel manager
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-secondary">
            Connetti TheFork, Google Reserve, Booking.com o un webhook custom: le prenotazioni
            arrivano in Tavolo come Booking interne.
          </p>
        </div>
        <ConnectorDialog />
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        <Stat label="Attivi" value={stats.active} hint="ricevono webhook" emphasized />
        <Stat label="Configurati" value={stats.total} hint="totali" />
        <Stat label="Eventi 30gg" value={stats.processed} hint="processati con successo" />
        <Stat
          label="Falliti / Rifiutati"
          value={stats.failed + stats.rejected}
          hint={
            stats.failed + stats.rejected > 0
              ? "controlla la configurazione"
              : "tutto in regola"
          }
        />
      </section>

      <Panel>
        <PanelHeader
          title="Canali configurati"
          description="Ogni canale ha un webhook URL univoco da incollare nel pannello del provider."
        />
        <PanelBody className="pt-0">
          {items.length === 0 ? (
            <EmptyStateRich
              icon={Network}
              title="Nessun connettore configurato"
              description="Aggiungi il primo canale (TheFork, Google Reserve, Booking, OpenTable, webhook custom) per ricevere prenotazioni esterne."
              primary={<ConnectorDialog />}
            />
          ) : (
            <ul className="divide-y divide-border text-sm">
              {items.map((c) => {
                const webhookUrl = `${baseUrl}/api/connectors/webhook/${ctx.venueId}/${c.kind}`;
                const meta = STATUS_META[c.status] ?? {
                  label: c.status,
                  tone: "bg-secondary text-secondary",
                };
                return (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-start justify-between gap-3 py-3"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gilt/15 text-gilt-light">
                        <Network className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium">
                          {KIND_LABEL[c.kind] ?? c.kind}
                          {c.label && (
                            <span className="ml-2 text-tertiary">· {c.label}</span>
                          )}
                        </p>
                        <p className="text-xs text-tertiary">
                          {c.externalRef ? `ext ${c.externalRef} · ` : ""}
                          {c.lastSyncAt
                            ? `ultimo evento ${formatDateTime(c.lastSyncAt)}`
                            : "nessun evento"}{" "}
                          · {c._count.events} eventi
                        </p>
                        <pre className="mt-2 max-w-full overflow-x-auto rounded-md bg-[hsl(var(--surface-sunken))]/50 px-2 py-1 font-mono text-[11px] text-secondary">
                          {webhookUrl}
                        </pre>
                        {c.lastError && (
                          <p className="mt-1 text-xs text-status-no-show">{c.lastError}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10.5px] font-medium",
                          meta.tone,
                        )}
                      >
                        {meta.label}
                      </span>
                      <ConnectorDialog
                        initial={{
                          id: c.id,
                          kind: c.kind as never,
                          label: c.label,
                          externalRef: c.externalRef,
                          status: c.status as never,
                          webhookSecret: c.webhookSecret,
                          webhookUrl,
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader
          title="Eventi recenti"
          description="Ultimi 30 eventi inbound (audit GDPR + troubleshooting)."
        />
        <PanelBody className="pt-0">
          {events.length === 0 ? (
            <p className="text-sm text-tertiary">Nessun evento ricevuto ancora.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {events.map((e) => {
                const meta = EVENT_META[e.status] ?? {
                  label: e.status,
                  tone: "bg-secondary text-secondary",
                };
                return (
                  <li key={e.id} className="flex items-center justify-between py-2.5">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {KIND_LABEL[e.connector?.kind ?? ""] ?? e.connector?.kind ?? "—"}
                        <span className="ml-2 text-xs text-tertiary">{e.kind}</span>
                      </p>
                      <p className="text-[11px] text-tertiary">
                        {e.direction} · {formatDateTime(e.createdAt)}
                        {e.error ? ` · ${e.error.slice(0, 80)}` : ""}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-medium",
                        meta.tone,
                      )}
                    >
                      {meta.label}
                    </span>
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
