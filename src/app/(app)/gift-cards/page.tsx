import Link from "next/link";
import { Gift, ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { can, getActiveVenue } from "@/lib/tenant";
import { giftCardStats, listGiftCards } from "@/server/gift-cards";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Stat } from "@/components/ui/stat";
import { EmptyStateRich } from "@/components/ui/empty-state-rich";
import { GiftCardDialog } from "@/components/gift-cards/gift-card-dialog";
import { GiftCardRedeemForm } from "@/components/gift-cards/redeem-form";
import { DeleteButton } from "@/components/gift-cards/delete-button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_META: Record<string, { label: string; tone: string }> = {
  ACTIVE: { label: "Attiva", tone: "bg-status-confirmed-soft text-status-confirmed" },
  EXHAUSTED: { label: "Esaurita", tone: "bg-secondary text-secondary" },
  EXPIRED: { label: "Scaduta", tone: "bg-status-pending-soft text-status-pending" },
  CANCELLED: { label: "Annullata", tone: "bg-status-no-show-soft text-status-no-show" },
  PENDING_PAYMENT: { label: "In pagamento", tone: "bg-status-pending-soft text-status-pending" },
};

export default async function GiftCardsPage() {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "edit_marketing")) {
    return (
      <EmptyStateRich
        icon={Gift}
        title="Accesso riservato"
        description="Solo i ruoli Marketing e Manager possono gestire le gift card."
      />
    );
  }
  const [items, stats, redemptions] = await Promise.all([
    listGiftCards(ctx.venueId),
    giftCardStats(ctx.venueId),
    db.giftCardRedemption.findMany({
      where: { giftCard: { venueId: ctx.venueId } },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { giftCard: { select: { code: true } } },
    }),
  ]);

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-tertiary">
            Vendite · Gift card
          </p>
          <h1 className="text-display mt-1 text-[34px] font-medium leading-tight tracking-tight">
            Gift card
          </h1>
          <p className="mt-1 text-sm text-secondary">
            Vendi codici regalo spendibili nel locale. Lo staff scala il saldo in cassa.
          </p>
        </div>
        <GiftCardDialog currency={ctx.venue.currency} />
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        <Stat label="Attive" value={stats.activeCount} hint="utilizzabili oggi" emphasized />
        <Stat
          label="Saldo in circolazione"
          value={formatCurrency(stats.activeFloatCents, ctx.venue.currency)}
          hint="passività verso clienti"
        />
        <Stat
          label="Vendute 30gg"
          value={`${stats.soldCount30d}`}
          hint={formatCurrency(stats.soldCents30d, ctx.venue.currency)}
        />
        <Stat
          label="Riscatti 30gg"
          value={`${stats.redemptionCount30d}`}
          hint={formatCurrency(stats.redeemedCents30d, ctx.venue.currency)}
        />
      </section>

      <Panel>
        <PanelHeader
          title="Riscatta in cassa"
          description="Inserisci codice + importo servito. Il saldo si aggiorna in tempo reale."
        />
        <PanelBody className="pt-0">
          <GiftCardRedeemForm currency={ctx.venue.currency} />
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader
          title="Tutte le gift card"
          description="Codici emessi ordinati per data."
        />
        <PanelBody className="pt-0">
          {items.length === 0 ? (
            <EmptyStateRich
              icon={Gift}
              title="Nessuna gift card emessa"
              description="Crea la prima gift card per iniziare a venderle dal sito o in cassa."
              primary={<GiftCardDialog currency={ctx.venue.currency} />}
            />
          ) : (
            <ul className="divide-y divide-border">
              {items.map((c) => {
                const meta = STATUS_META[c.status] ?? {
                  label: c.status,
                  tone: "bg-secondary text-secondary",
                };
                const balancePct =
                  c.initialCents > 0
                    ? Math.round((c.balanceCents / c.initialCents) * 100)
                    : 0;
                return (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gilt/15 text-gilt-light">
                        <Gift className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-mono text-base font-semibold">{c.code}</p>
                        <p className="mt-0.5 text-xs text-tertiary">
                          <span className="text-display text-numeric text-foreground">
                            {formatCurrency(c.balanceCents, c.currency)}
                          </span>
                          <span className="text-tertiary">
                            {" "}
                            / {formatCurrency(c.initialCents, c.currency)}
                          </span>
                          {c.recipientName ? ` · ${c.recipientName}` : ""}
                          {" · "}
                          {c._count.redemptions} riscatti ·{" "}
                          {c.expiresAt ? `scade ${formatDate(c.expiresAt)}` : "nessuna scadenza"}
                        </p>
                        {c.message && (
                          <p className="mt-1 max-w-md text-xs italic text-tertiary">
                            &ldquo;{c.message}&rdquo;
                          </p>
                        )}
                        {/* Balance progress */}
                        <div className="mt-2 h-1 w-48 overflow-hidden rounded-full bg-secondary">
                          <div
                            className={cn(
                              "h-full transition-all duration-700",
                              balancePct >= 80
                                ? "bg-status-confirmed"
                                : balancePct >= 30
                                  ? "bg-status-pending"
                                  : "bg-status-no-show",
                            )}
                            style={{ width: `${balancePct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10.5px] font-medium",
                          meta.tone,
                        )}
                      >
                        {meta.label}
                      </span>
                      <Link
                        href={`/gift/${c.code}`}
                        target="_blank"
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] font-medium text-secondary transition-colors hover:border-border-strong hover:text-foreground"
                      >
                        Pagina pubblica <ExternalLink className="h-3 w-3" />
                      </Link>
                      {c.balanceCents === c.initialCents && <DeleteButton id={c.id} />}
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
          title="Ultimi riscatti"
          description="Audit dei movimenti recenti."
        />
        <PanelBody className="pt-0">
          {redemptions.length === 0 ? (
            <p className="text-sm text-tertiary">Nessun riscatto ancora.</p>
          ) : (
            <ul className="divide-y divide-border text-xs">
              {redemptions.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-mono text-sm">{r.giftCard.code}</p>
                    <p className="text-[11px] text-tertiary">
                      {r.reason ?? "Riscatto"} · {formatDate(r.createdAt)}
                    </p>
                  </div>
                  <span className="text-display text-numeric text-status-no-show font-medium">
                    −{formatCurrency(r.amountCents, ctx.venue.currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </PanelBody>
      </Panel>
    </div>
  );
}
