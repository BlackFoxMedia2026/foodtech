import Link from "next/link";
import { Gift, ExternalLink, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { can, getActiveVenue } from "@/lib/tenant";
import { giftCardStats, listGiftCards } from "@/server/gift-cards";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/overview/stat-card";
import { GiftCardDialog } from "@/components/gift-cards/gift-card-dialog";
import { GiftCardRedeemForm } from "@/components/gift-cards/redeem-form";
import { DeleteButton } from "@/components/gift-cards/delete-button";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  ACTIVE: "success",
  EXHAUSTED: "neutral",
  EXPIRED: "warning",
  CANCELLED: "danger",
  PENDING_PAYMENT: "warning",
};

export default async function GiftCardsPage() {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "edit_marketing")) {
    return (
      <div className="rounded-md border p-8 text-sm text-muted-foreground">
        Solo i ruoli marketing/manager possono gestire le gift card.
      </div>
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
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Marketing</p>
          <h1 className="text-display text-3xl">Gift card</h1>
          <p className="text-sm text-muted-foreground">
            Vendi codici regalo spendibili sul locale. Lo staff scala il saldo in cassa.
          </p>
        </div>
        <GiftCardDialog currency={ctx.venue.currency} />
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        <StatCard label="Attive" value={String(stats.activeCount)} emphasize />
        <StatCard
          label="Saldo in giro"
          value={formatCurrency(stats.activeFloatCents, ctx.venue.currency)}
        />
        <StatCard
          label="Vendute 30gg"
          value={`${stats.soldCount30d} · ${formatCurrency(stats.soldCents30d, ctx.venue.currency)}`}
        />
        <StatCard
          label="Riscatti 30gg"
          value={`${stats.redemptionCount30d} · ${formatCurrency(stats.redeemedCents30d, ctx.venue.currency)}`}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Riscatta in cassa</CardTitle>
          <CardDescription>
            Inserisci codice + importo servito. Il saldo si aggiorna in tempo reale.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GiftCardRedeemForm currency={ctx.venue.currency} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tutte le gift card</CardTitle>
          <CardDescription>Ordina per stato e data emissione.</CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
              Nessuna gift card emessa. Crea la prima per iniziare.
            </p>
          ) : (
            <ul className="divide-y text-sm">
              {items.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-start justify-between gap-3 py-3"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-md bg-gilt/10 text-gilt-dark">
                      <Gift className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-mono text-base font-medium">{c.code}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(c.balanceCents, c.currency)} /
                        {formatCurrency(c.initialCents, c.currency)} ·{" "}
                        {c.recipientName ? `${c.recipientName} · ` : ""}
                        {c._count.redemptions} riscatti ·{" "}
                        {c.expiresAt ? `scade ${formatDate(c.expiresAt)}` : "nessuna scadenza"}
                      </p>
                      {c.message && (
                        <p className="mt-1 max-w-md text-xs italic text-muted-foreground">
                          &ldquo;{c.message}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={STATUS_TONE[c.status] ?? "neutral"}>{c.status}</Badge>
                    <Link
                      href={`/gift/${c.code}`}
                      target="_blank"
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Pagina pubblica <ExternalLink className="h-3 w-3" />
                    </Link>
                    {c.balanceCents === c.initialCents && (
                      <DeleteButton id={c.id} />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ultimi riscatti</CardTitle>
          <CardDescription>Audit dei movimenti recenti.</CardDescription>
        </CardHeader>
        <CardContent>
          {redemptions.length === 0 ? (
            <p className="rounded-md border border-dashed p-8 text-center text-xs text-muted-foreground">
              Nessun riscatto ancora.
            </p>
          ) : (
            <ul className="divide-y text-xs">
              {redemptions.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-mono">{r.giftCard.code}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {r.reason ?? "—"} · {formatDate(r.createdAt)}
                    </p>
                  </div>
                  <span className="text-rose-700">
                    -{formatCurrency(r.amountCents, ctx.venue.currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
