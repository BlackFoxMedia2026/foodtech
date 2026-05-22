import { CreditCard } from "lucide-react";
import { can, getActiveVenue } from "@/lib/tenant";
import { listPOSConnectors, listPOSEvents, posStats } from "@/server/pos";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Stat } from "@/components/ui/stat";
import { EmptyStateRich } from "@/components/ui/empty-state-rich";
import { POSConnectorDialog } from "@/components/pos/pos-dialog";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  SQUARE: "Square",
  LIGHTSPEED: "Lightspeed Restaurant",
  SUMUP: "SumUp",
  IZETTLE: "iZettle / Zettle",
  TOAST: "Toast",
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

export default async function POSPage() {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "manage_venue")) {
    return (
      <EmptyStateRich
        icon={CreditCard}
        title="Accesso riservato al Manager"
        description="Solo il ruolo Manager può configurare i POS."
      />
    );
  }
  const baseUrl =
    process.env.NEXTAUTH_URL ||
    `https://${process.env.VERCEL_URL || "localhost:3000"}`;
  const [items, events, stats] = await Promise.all([
    listPOSConnectors(ctx.venueId),
    listPOSEvents(ctx.venueId, 30),
    posStats(ctx.venueId),
  ]);

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-tertiary">
            Vendite · Punto cassa
          </p>
          <h1 className="text-display mt-1 text-[34px] font-medium leading-tight tracking-tight">
            POS &amp; integrazioni cassa
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-secondary">
            Connetti il punto cassa: ogni vendita atterra in Tavolo come Order, con loyalty
            credit automatico se associata a un ospite.
          </p>
        </div>
        <POSConnectorDialog />
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        <Stat label="POS attivi" value={stats.activeCount} hint="ricevono webhook" emphasized />
        <Stat label="Configurati" value={stats.totalCount} hint="totali" />
        <Stat label="Vendite 30gg" value={stats.processed30d} hint="eventi processati" />
        <Stat
          label="Ricavi 30gg"
          value={formatCurrency(stats.revenue30dCents, ctx.venue.currency)}
          hint="incasso loyalty tracciato"
        />
      </section>

      <Panel>
        <PanelHeader
          title="POS configurati"
          description="Ogni POS ha un webhook URL univoco. Configura lo stesso secret HMAC su entrambi i lati per evitare ingest abusivi."
        />
        <PanelBody className="pt-0">
          {items.length === 0 ? (
            <EmptyStateRich
              icon={CreditCard}
              title="Nessun POS connesso"
              description="Aggiungi il primo POS (Square, Lightspeed, SumUp, Toast, webhook custom) per tracciare le vendite e accreditare loyalty automaticamente."
              primary={<POSConnectorDialog />}
            />
          ) : (
            <ul className="divide-y divide-border">
              {items.map((c) => {
                const webhookUrl = `${baseUrl}/api/pos/webhook/${ctx.venueId}/${c.kind}`;
                const meta = STATUS_META[c.status] ?? {
                  label: c.status,
                  tone: "bg-secondary text-secondary",
                };
                return (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gilt/15 text-gilt-light">
                        <CreditCard className="h-4 w-4" />
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
                            ? `ultima vendita ${formatDateTime(c.lastSyncAt)}`
                            : "nessuna vendita ancora"}{" "}
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
                      <POSConnectorDialog
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
          title="Vendite recenti"
          description="Ultimi 30 eventi inbound dai webhook POS."
        />
        <PanelBody className="pt-0">
          {events.length === 0 ? (
            <p className="text-sm text-tertiary">Nessun evento ancora.</p>
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
                        <span className="ml-2 text-xs text-tertiary">{e.action}</span>
                      </p>
                      <p className="text-[11px] text-tertiary">
                        {formatDateTime(e.createdAt)}
                        {e.externalRef ? ` · ext ${e.externalRef}` : ""}
                        {e.error ? ` · ${e.error.slice(0, 80)}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {e.amountCents > 0 && (
                        <span className="text-display text-numeric text-sm font-medium">
                          {formatCurrency(e.amountCents, e.currency)}
                        </span>
                      )}
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-medium",
                          meta.tone,
                        )}
                      >
                        {meta.label}
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
