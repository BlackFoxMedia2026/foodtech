import { Network } from "lucide-react";
import { getActiveVenue, can } from "@/lib/tenant";
import {
  connectorStats,
  listConnectorEvents,
  listConnectors,
} from "@/server/connectors";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/overview/stat-card";
import { ConnectorDialog } from "@/components/connectors/connector-dialog";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  THEFORK: "TheFork",
  GOOGLE_RESERVE: "Google Reserve",
  BOOKING_COM: "Booking.com",
  OPENTABLE: "OpenTable",
  CUSTOM: "Webhook personalizzato",
};

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  ACTIVE: "success",
  PAUSED: "warning",
  ERROR: "danger",
  DRAFT: "neutral",
};

const EVENT_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  PROCESSED: "success",
  RECEIVED: "neutral",
  REJECTED: "warning",
  FAILED: "danger",
};

export default async function ConnectorsPage() {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "manage_venue")) {
    return (
      <div className="rounded-md border p-8 text-sm text-muted-foreground">
        Solo i manager possono configurare i connettori esterni.
      </div>
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
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Operations</p>
          <h1 className="text-display text-3xl">Channel manager</h1>
          <p className="text-sm text-muted-foreground">
            Connetti TheFork, Google Reserve, Booking.com o un webhook custom: le prenotazioni
            arrivano in Tavolo come Booking interne.
          </p>
        </div>
        <ConnectorDialog />
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        <StatCard label="Connettori attivi" value={String(stats.active)} emphasize />
        <StatCard label="Configurati" value={String(stats.total)} />
        <StatCard label="Eventi 30gg processati" value={String(stats.processed)} />
        <StatCard label="Falliti / rifiutati" value={String(stats.failed + stats.rejected)} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Canali configurati</CardTitle>
          <CardDescription>
            Ogni canale ha un webhook URL univoco da incollare nel pannello del provider.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
              Nessun connettore. Aggiungi il primo per ricevere prenotazioni esterne.
            </p>
          ) : (
            <ul className="divide-y text-sm">
              {items.map((c) => {
                const webhookUrl = `${baseUrl}/api/connectors/webhook/${ctx.venueId}/${c.kind}`;
                return (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-start justify-between gap-3 py-3"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="grid h-9 w-9 place-items-center rounded-md bg-gilt/10 text-gilt-dark">
                        <Network className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium">
                          {KIND_LABEL[c.kind] ?? c.kind}
                          {c.label ? <span className="ml-2 text-muted-foreground">· {c.label}</span> : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {c.externalRef ? `ext ${c.externalRef} · ` : ""}
                          {c.lastSyncAt
                            ? `ultimo evento ${formatDateTime(c.lastSyncAt)}`
                            : "nessun evento"}
                          {" · "}
                          {c._count.events} eventi
                        </p>
                        <pre className="mt-1 max-w-full overflow-x-auto rounded-md bg-secondary px-2 py-1 text-[11px]">
                          {webhookUrl}
                        </pre>
                        {c.lastError && (
                          <p className="mt-1 text-xs text-destructive">{c.lastError}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={STATUS_TONE[c.status] ?? "neutral"}>{c.status}</Badge>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Eventi recenti</CardTitle>
          <CardDescription>Ultimi 30 eventi inbound (audit GDPR + troubleshooting).</CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              Nessun evento ricevuto ancora.
            </p>
          ) : (
            <ul className="divide-y text-sm">
              {events.map((e) => (
                <li key={e.id} className="flex items-center justify-between py-2">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {KIND_LABEL[e.connector?.kind ?? ""] ?? e.connector?.kind ?? "—"}
                      <span className="ml-2 text-xs text-muted-foreground">{e.kind}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {e.direction} · {formatDateTime(e.createdAt)}
                      {e.error ? ` · ${e.error.slice(0, 80)}` : ""}
                    </p>
                  </div>
                  <Badge tone={EVENT_TONE[e.status] ?? "neutral"}>{e.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
