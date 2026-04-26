import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { lookupOffer } from "@/server/waitlist-promotion";
import { getVenueBrandBySlug } from "@/server/branding";
import { Card, CardContent } from "@/components/ui/card";
import { OfferActions } from "@/components/waitlist/offer-actions";
import { PublicFootnote, PublicHeader } from "@/components/branding/public-shell";

export const dynamic = "force-dynamic";

export default async function WaitlistOfferPage({
  params,
}: {
  params: { token: string };
}) {
  const entry = await lookupOffer(params.token);
  if (!entry) notFound();
  const brand = await getVenueBrandBySlug(entry.venue.slug);
  const expired =
    entry.offerExpiresAt && entry.offerExpiresAt < new Date();
  const handled =
    entry.status === "CONFIRMED" ||
    entry.status === "DECLINED" ||
    entry.status === "EXPIRED" ||
    entry.status === "SEATED";

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col gap-6 px-4 py-10">
      {brand && <PublicHeader brand={brand} kicker="Offerta tavolo" />}

      <Card className="overflow-hidden">
        <div
          className="p-6 text-carbon-900"
          style={brand ? { background: brand.accent } : undefined}
        >
          <CheckCircle2 className="h-7 w-7" />
          <p className="mt-2 text-xs uppercase tracking-[0.2em]">Tavolo libero</p>
          <h1 className="text-display text-3xl">{entry.venue.name}</h1>
          <p className="mt-1 text-sm">
            Per {entry.partySize}{" "}
            {entry.partySize === 1 ? "persona" : "persone"} · {entry.guestName}
          </p>
        </div>
        <CardContent className="space-y-4 py-5 text-sm">
          {entry.venue.address && (
            <p className="text-muted-foreground">
              {entry.venue.address}
              {entry.venue.city ? `, ${entry.venue.city}` : ""}
            </p>
          )}

          {handled || expired ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {entry.status === "CONFIRMED"
                ? "Hai già confermato questo tavolo. Ci vediamo all'ingresso!"
                : entry.status === "DECLINED"
                  ? "Hai rifiutato questa offerta."
                  : "L'offerta è scaduta. Avvisa lo staff se vuoi rimanere in lista."}
            </div>
          ) : (
            <>
              <p>
                Il tavolo è disponibile per i prossimi minuti. Conferma se vuoi che ti
                aspettiamo, altrimenti lo offriamo a chi è in coda.
              </p>
              <OfferActions token={params.token} />
              <p className="text-xs text-muted-foreground">
                Scade alle{" "}
                {entry.offerExpiresAt?.toLocaleTimeString("it-IT", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                .
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {brand && <PublicFootnote brand={brand} />}
    </div>
  );
}
