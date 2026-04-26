import Link from "next/link";
import { ExternalLink, Tag } from "lucide-react";
import { getActiveVenue, can } from "@/lib/tenant";
import { listCoupons, couponStats } from "@/server/coupons";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/overview/stat-card";
import { CouponDialog } from "@/components/coupons/coupon-dialog";
import { formatCurrency, formatDate } from "@/lib/utils";

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

const STATUS_TONE = {
  ACTIVE: "success",
  PAUSED: "warning",
  EXPIRED: "neutral",
  ARCHIVED: "neutral",
} as const;

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
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Marketing</p>
          <h1 className="text-display text-3xl">Coupon & promozioni</h1>
          <p className="text-sm text-muted-foreground">
            Crea codici per compleanni, win-back, eventi. Valida al ritiro/checkout.
          </p>
        </div>
        {canEdit && <CouponDialog currency={ctx.venue.currency} />}
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        <StatCard label="Coupon totali" value={String(stats.total)} />
        <StatCard label="Attivi" value={String(stats.active)} emphasize />
        <StatCard label="Riscatti" value={String(stats.redeemed)} />
        <StatCard
          label="Sconti riscattati"
          value={formatCurrency(stats.valueCentsRedeemed, ctx.venue.currency)}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Tutti i coupon</CardTitle>
          <CardDescription>Click su &ldquo;Apri pubblico&rdquo; per condividere il link.</CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
              Ancora nessun coupon. Crea il primo per iniziare.
            </p>
          ) : (
            <ul className="divide-y text-sm">
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
                return (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="grid h-9 w-9 place-items-center rounded-md bg-gilt/10 text-gilt-dark">
                        <Tag className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium">
                          {c.name}{" "}
                          <span className="ml-2 font-mono text-xs text-muted-foreground">
                            {c.code}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {KIND_LABEL[c.kind]} · {CATEGORY_LABEL[c.category]} · {usage}
                          {c.validUntil ? ` · scade ${formatDate(c.validUntil)}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-display text-lg text-gilt-dark">{valueLabel}</span>
                      <Badge tone={STATUS_TONE[c.status]}>{c.status}</Badge>
                      <Link
                        href={`/coupon/${c.code}`}
                        target="_blank"
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
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
        </CardContent>
      </Card>
    </div>
  );
}
