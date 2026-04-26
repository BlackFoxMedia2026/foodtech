import { CreditCard } from "lucide-react";
import { can, getActiveVenue } from "@/lib/tenant";
import { listPOSConnectors, listPOSEvents, posStats } from "@/server/pos";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/overview/stat-card";
import { POSConnectorDialog } from "@/components/pos/pos-dialog";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  SQUARE: "Square",
  LIGHTSPEED: "Lightspeed Restaurant",
  SUMUP: "SumUp",
  IZETTLE: "iZettle / Zettle",
  TOAST: "Toast",
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

export default async function POSPage() {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "manage_venue")) {
    return (
      <div className="rounded-md border p-8 text-sm text-muted-foreground">
        Solo i manager possono configurare i POS.
      </div>
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
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Operations</p>
          <h1 className="text-display text-3xl">POS · punto cassa</h1>
          <p className="text-sm text-muted-foreground">
            Connetti il punto cassa: ogni vendita atterra in Tavolo come Order, con loyalty
            credit automatico se associata a un ospite.
          </p>
        </div>
        <POSConnectorDialog />
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        <StatCard label="POS attivi" value={String(stats.activeCount)} emphasize />
        <StatCard label="Configurati" value={String(stats.totalCount)} />
        <StatCard label="Vendite 30gg" value={String(stats.processed30d)} />
        <StatCard
          label="Ricavi 30gg"
          value={formatCurrency(stats.revenue30dCents, ctx.venue.currency)}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>POS configurati</CardTitle>
          <CardDescription>
            Ogni POS ha un webhook URL univoco. Configura lo stesso secret HMAC su entrambi i
            lati per evitare ingest abusivi.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
              Nessun POS connesso. Aggiungi il primo per iniziare a tracciare le vendite.
            </p>
          ) : (
            <ul className="divide-y text-sm">
              {items.map((c) => {
                const webhookUrl = `${baseUrl}/api/pos/webhook/${ctx.venueId}/${c.kind}`;
                return (
                  <li key={c.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="grid h-9 w-9 place-items-center rounded-md bg-gilt/10 text-gilt-dark">
                        <CreditCard className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium">
                          {KIND_LABEL[c.kind] ?? c.kind}
                          {c.label ? <span className="ml-2 text-muted-foreground">· {c.label}</span> : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {c.externalRef ? `ext ${c.externalRef} · ` : ""}
                          {c.lastSyncAt
                            ? `ultima vendita ${formatDateTime(c.lastSyncAt)}`
                            : "nessuna vendita ancora"}
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vendite recenti</CardTitle>
          <CardDescription>Ultimi 30 eventi inbound dal POS.</CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              Nessun evento ancora.
            </p>
          ) : (
            <ul className="divide-y text-sm">
              {events.map((e) => (
                <li key={e.id} className="flex items-center justify-between py-2">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {KIND_LABEL[e.connector?.kind ?? ""] ?? e.connector?.kind ?? "—"}
                      <span className="ml-2 text-xs text-muted-foreground">{e.action}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(e.createdAt)}
                      {e.externalRef ? ` · ext ${e.externalRef}` : ""}
                      {e.error ? ` · ${e.error.slice(0, 80)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {e.amountCents > 0 && (
                      <span className="text-muted-foreground">
                        {formatCurrency(e.amountCents, e.currency)}
                      </span>
                    )}
                    <Badge tone={EVENT_TONE[e.status] ?? "neutral"}>{e.status}</Badge>
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
