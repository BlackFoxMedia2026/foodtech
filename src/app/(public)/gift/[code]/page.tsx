import { notFound } from "next/navigation";
import { Gift } from "lucide-react";
import { lookupGiftCard } from "@/server/gift-cards";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function GiftCardPublicPage({
  params,
}: {
  params: { code: string };
}) {
  const card = await lookupGiftCard(params.code);
  if (!card) notFound();

  const balance = formatCurrency(card.balanceCents, card.currency);
  const initial = formatCurrency(card.initialCents, card.currency);
  const partial = card.balanceCents !== card.initialCents;

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col gap-6 px-4 py-10">
      <header className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-carbon-800 text-sand-50 font-display text-xs">
          T
        </span>
        Tavolo · gift card
      </header>

      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-gilt to-gilt-dark p-6 text-carbon-900">
          <div className="flex items-center justify-between">
            <Gift className="h-7 w-7" />
            <span className="text-[10px] uppercase tracking-[0.2em]">{card.venue.name}</span>
          </div>
          <p className="mt-4 text-xs uppercase tracking-widest">Saldo</p>
          <p className="text-display text-4xl">{balance}</p>
          {partial && (
            <p className="text-xs">
              su {initial} originali — utilizzata in parte
            </p>
          )}
        </div>
        <CardContent className="space-y-3 py-5 text-sm">
          {card.recipientName && (
            <p>
              Per <strong>{card.recipientName}</strong>
              {card.senderName ? <> da {card.senderName}</> : null}
            </p>
          )}
          {card.message && (
            <p className="rounded-md border bg-secondary/40 p-3 italic">&ldquo;{card.message}&rdquo;</p>
          )}
          <p className="font-mono text-base text-muted-foreground">{card.code}</p>
          <p className="text-xs text-muted-foreground">
            {card.expiresAt
              ? `Valida fino al ${formatDate(card.expiresAt)}`
              : "Senza scadenza"}
            {card.status === "EXHAUSTED" && " · saldo esaurito"}
            {card.status === "EXPIRED" && " · scaduta"}
            {card.status === "CANCELLED" && " · annullata"}
          </p>
          <p className="text-xs text-muted-foreground">
            Mostra questo codice in cassa o presso lo staff di {card.venue.name}
            {card.venue.city ? ` (${card.venue.city})` : ""} per scalare il saldo dal conto.
          </p>
        </CardContent>
      </Card>

      <footer className="mt-auto pt-4 text-[10px] text-muted-foreground">
        Powered by Tavolo · saldo aggiornato in tempo reale.
      </footer>
    </div>
  );
}
