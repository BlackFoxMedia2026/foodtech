import { CreditCard } from "lucide-react";
import { db } from "@/lib/db";
import { can, getActiveVenue } from "@/lib/tenant";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Stat } from "@/components/ui/stat";
import { EmptyStateRich } from "@/components/ui/empty-state-rich";
import { ExportButton } from "@/components/ui/export-button";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

function formatDateShort(d: Date) {
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export const dynamic = "force-dynamic";

const KIND_LABEL = {
  DEPOSIT: "Caparra",
  PREAUTH: "Preautorizzazione",
  TICKET: "Ticket",
  REFUND: "Rimborso",
  PACKAGE: "Pacchetto",
} as const;

const STATUS_META: Record<
  string,
  { label: string; tone: string }
> = {
  PENDING: { label: "In attesa", tone: "bg-status-pending-soft text-status-pending" },
  SUCCEEDED: { label: "Completato", tone: "bg-status-confirmed-soft text-status-confirmed" },
  FAILED: { label: "Errore", tone: "bg-status-no-show-soft text-status-no-show" },
  REFUNDED: { label: "Rimborsato", tone: "bg-secondary text-secondary" },
};

export default async function PaymentsPage() {
  const ctx = await getActiveVenue();
  const items = await db.payment.findMany({
    where: { venueId: ctx.venueId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { booking: true, guest: true },
  });

  const total = items
    .filter((p) => p.status === "SUCCEEDED")
    .reduce((s, p) => s + p.amountCents, 0);
  const refunded = items
    .filter((p) => p.status === "REFUNDED")
    .reduce((s, p) => s + p.amountCents, 0);
  const pending = items.filter((p) => p.status === "PENDING").length;
  const failed = items.filter((p) => p.status === "FAILED").length;

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-tertiary">
            Vendite · Movimenti finanziari
          </p>
          <h1 className="text-display mt-1 text-[34px] font-medium leading-tight tracking-tight">
            Pagamenti
          </h1>
          <p className="mt-1 text-sm text-secondary">
            Caparre, preautorizzazioni, ticket eventi e rimborsi in un unico registro.
          </p>
        </div>
        {can(ctx.role, "view_revenue") && <ExportButton kind="payments" />}
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        <Stat
          label="Incassato"
          value={formatCurrency(total, ctx.venue.currency)}
          hint="ultimi 100 movimenti SUCCEEDED"
          emphasized
        />
        <Stat
          label="Rimborsato"
          value={formatCurrency(refunded, ctx.venue.currency)}
          hint={refunded > 0 ? "controlla la motivazione" : "nessun rimborso"}
        />
        <Stat
          label="In attesa"
          value={pending}
          hint={pending > 0 ? "richiede follow-up" : "tutto chiuso"}
          delta={
            pending > 0 ? { value: "follow-up", tone: "negative" } : undefined
          }
        />
        <Stat
          label="Falliti"
          value={failed}
          hint={failed > 0 ? "verifica configurazione" : "nessun errore"}
          delta={
            failed > 0
              ? { value: "errore", tone: "negative" }
              : undefined
          }
        />
      </section>

      <Panel>
        <PanelHeader
          title={
            <span className="inline-flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-tertiary" /> Movimenti recenti
            </span>
          }
          description={`${items.length} movimenti · ordine dal più recente`}
        />
        <PanelBody className="pt-0">
          {items.length === 0 ? (
            <EmptyStateRich
              icon={CreditCard}
              title="Nessun pagamento registrato"
              description="I pagamenti compaiono qui automaticamente quando configuri Stripe e gli ospiti pagano caparre, ticket eventi o preautorizzazioni."
              hint="Imposta STRIPE_SECRET_KEY in env per attivare i pagamenti reali."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-[hsl(var(--surface-sunken))]/60 text-[10.5px] font-medium uppercase tracking-[0.14em] text-tertiary">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Data</th>
                    <th className="px-4 py-3 text-left font-medium">Tipo</th>
                    <th className="px-4 py-3 text-left font-medium">Ospite</th>
                    <th className="px-4 py-3 text-right font-medium">Importo</th>
                    <th className="px-4 py-3 text-left font-medium">Stato</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((p) => {
                    const meta = STATUS_META[p.status] ?? {
                      label: p.status,
                      tone: "bg-secondary text-secondary",
                    };
                    return (
                      <tr key={p.id} className="transition-colors hover:bg-secondary/40">
                        <td className="px-4 py-3 text-numeric text-tertiary">
                          {formatDateTime(p.createdAt)}
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {KIND_LABEL[p.kind]}
                        </td>
                        <td className="px-4 py-3 text-secondary">
                          {p.guest
                            ? `${p.guest.firstName} ${p.guest.lastName ?? ""}`.trim()
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-display text-numeric text-base font-medium tabular-nums">
                            {formatCurrency(p.amountCents, p.currency)}
                          </span>
                          {p.fxAmountBaseCents !== null &&
                          p.fxBaseCurrency &&
                          p.fxRateToBase &&
                          p.currency.toUpperCase() !== p.fxBaseCurrency.toUpperCase() ? (
                            <div className="mt-0.5 text-[11px] text-tertiary tabular-nums">
                              ≈ {formatCurrency(p.fxAmountBaseCents, p.fxBaseCurrency)}{" "}
                              <span className="text-quaternary">
                                (rate {Number(p.fxRateToBase).toFixed(4)} al{" "}
                                {formatDateShort(p.createdAt)})
                              </span>
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-medium",
                              meta.tone,
                            )}
                          >
                            {meta.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </PanelBody>
      </Panel>
    </div>
  );
}
