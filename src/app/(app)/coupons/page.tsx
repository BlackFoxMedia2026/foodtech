import Link from "next/link";
import { ExternalLink, Tag } from "lucide-react";
import { getActiveVenue, can } from "@/lib/tenant";
import { listCoupons, couponStats } from "@/server/coupons";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Stat } from "@/components/ui/stat";
import { EmptyStateRich } from "@/components/ui/empty-state-rich";
import { CouponDialog } from "@/components/coupons/coupon-dialog";
import { formatCurrency, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const KIND_LABEL = {
  PERCENT: "Percentuale",
  FIXED: "Importo fisso",
  FREE_ITEM: "Omaggio",
  MENU_OFFER: "Menu speciale",
} as const;

const CATEGORY_LABEL = {
  GENERIC: "Generico",
  BIRTHDAY: "Compleanno",
  WINBACK: "Recupero",
  EVENT: "Evento",
  NEW_CUSTOMER: "Nuovo cliente",
  WIFI: "Wi-Fi",
  REFERRAL: "Referral",
  STAFF: "Staff",
} as const;

const STATUS_META: Record<string, { label: string; tone: string }> = {
  ACTIVE: { label: "Attivo", tone: "bg-status-confirmed-soft text-status-confirmed" },
  PAUSED: { label: "In pausa", tone: "bg-status-pending-soft text-status-pending" },
  EXPIRED: { label: "Scaduto", tone: "bg-secondary text-secondary" },
  ARCHIVED: { label: "Archiviato", tone: "bg-secondary text-secondary" },
};

export default async function CouponsPage() {
  const ctx = await getActiveVenue();
  const [items, stats] = await Promise.all([
    listCoupons(ctx.venueId),
    couponStats(ctx.venueId),
  ]);
  const canEdit = can(ctx.role, "edit_marketing");

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-tertiary">
            Vendite · Promozioni
          </p>
          <h1 className="text-display mt-1 text-[34px] font-medium leading-tight tracking-tight">
            Coupon &amp; promozioni
          </h1>
          <p className="mt-1 text-sm text-secondary">
            Crea codici per compleanni, win-back ed eventi. Valida al ritiro o al checkout.
          </p>
        </div>
        {canEdit && <CouponDialog currency={ctx.venue.currency} />}
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        <Stat label="Coupon totali" value={stats.total} hint="archivio completo" />
        <Stat label="Attivi" value={stats.active} hint="utilizzabili oggi" emphasized />
        <Stat label="Riscatti" value={stats.redeemed} hint="dall'inizio" />
        <Stat
          label="Sconti riscattati"
          value={formatCurrency(stats.valueCentsRedeemed, ctx.venue.currency)}
          hint="valore reale erogato"
        />
      </section>

      <Panel>
        <PanelHeader
          title="Tutti i coupon"
          description="Click su 'Apri pubblico' per copiare il link da condividere via SMS, email o QR."
        />
        <PanelBody className="pt-0">
          {items.length === 0 ? (
            <EmptyStateRich
              icon={Tag}
              title="Nessun coupon creato"
              description="Crea il primo coupon per attivare campagne di win-back, compleanni, eventi e nuovi clienti."
              primary={canEdit ? <CouponDialog currency={ctx.venue.currency} /> : undefined}
              hint="I coupon si collegano automaticamente alle automazioni Growth."
            />
          ) : (
            <ul className="divide-y divide-border">
              {items.map((c) => {
                const valueLabel =
                  c.kind === "PERCENT"
                    ? `${c.value}%`
                    : c.kind === "FIXED"
                      ? formatCurrency(c.value, ctx.venue.currency)
                      : c.kind === "FREE_ITEM"
                        ? c.freeItem ?? "Omaggio"
                        : "Menu offer";
                const usage = c.maxRedemptions
                  ? `${c.redemptionCount}/${c.maxRedemptions}`
                  : `${c.redemptionCount} riscatti`;
                const meta = STATUS_META[c.status] ?? {
                  label: c.status,
                  tone: "bg-secondary text-secondary",
                };
                return (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gilt/15 text-gilt-light">
                        <Tag className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 font-medium">
                          {c.name}
                          <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-secondary">
                            {c.code}
                          </span>
                        </p>
                        <p className="text-xs text-tertiary">
                          {KIND_LABEL[c.kind]} · {CATEGORY_LABEL[c.category]} · {usage}
                          {c.validUntil ? ` · scade ${formatDate(c.validUntil)}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-display text-numeric text-xl font-medium text-gilt-light">
                        {valueLabel}
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10.5px] font-medium",
                          meta.tone,
                        )}
                      >
                        {meta.label}
                      </span>
                      <Link
                        href={`/coupon/${c.code}`}
                        target="_blank"
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] font-medium text-secondary transition-colors hover:border-border-strong hover:text-foreground"
                      >
                        Apri pubblico <ExternalLink className="h-3 w-3" />
                      </Link>
                      {canEdit && (
                        <CouponDialog
                          currency={ctx.venue.currency}
                          initial={{
                            id: c.id,
                            code: c.code,
                            name: c.name,
                            description: c.description,
                            kind: c.kind,
                            value: c.value,
                            freeItem: c.freeItem,
                            category: c.category,
                            status: c.status,
                            validFrom: c.validFrom?.toISOString() ?? null,
                            validUntil: c.validUntil?.toISOString() ?? null,
                            maxRedemptions: c.maxRedemptions,
                            maxPerGuest: c.maxPerGuest,
                          }}
                        />
                      )}
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
