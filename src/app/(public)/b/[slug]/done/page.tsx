import Link from "next/link";
import { CheckCircle2, CalendarClock, Users, AlertTriangle, CreditCard } from "lucide-react";
import { notFound } from "next/navigation";
import { getBookingByReference, getPublicVenue } from "@/server/widget";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function BookingConfirmationPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { ref?: string; paid?: string };
}) {
  const ref = searchParams.ref;
  if (!ref) notFound();

  const venue = await getPublicVenue(params.slug);
  if (!venue) notFound();

  const booking = await getBookingByReference(params.slug, ref);
  if (!booking) notFound();

  const guestName = booking.guest
    ? [booking.guest.firstName, booking.guest.lastName].filter(Boolean).join(" ")
    : "ospite";

  const paidParam = searchParams.paid;
  const paymentFailed = paidParam === "0" || booking.depositStatus === "FAILED";
  const paymentHeld = paidParam === "1" || booking.depositStatus === "HELD" || booking.depositStatus === "CAPTURED";
  const headline = paymentFailed
    ? "Caparra non confermata"
    : paymentHeld
      ? `Grazie ${guestName.split(" ")[0]}, prenotazione confermata.`
      : `Grazie ${guestName.split(" ")[0]}, ci siamo quasi.`;
  const subhead = paymentFailed
    ? "Il pagamento della caparra non è andato a buon fine. Puoi riprovare o contattare il locale."
    : paymentHeld
      ? `La caparra è stata trattenuta. Il tavolo presso ${venue.name} ti aspetta.`
      : `Il team di ${venue.name} conferma la richiesta a breve. Riceverai un'email con tutti i dettagli.`;

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-6 px-6 py-10 text-center">
      <span
        className={
          paymentFailed
            ? "grid h-14 w-14 place-items-center rounded-full bg-rose-100 text-rose-600"
            : "grid h-14 w-14 place-items-center rounded-full bg-gilt/15 text-gilt-dark"
        }
      >
        {paymentFailed ? <AlertTriangle className="h-7 w-7" /> : <CheckCircle2 className="h-7 w-7" />}
      </span>
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.18em] text-gilt-dark">
          {paymentFailed ? "Pagamento non riuscito" : paymentHeld ? "Prenotazione confermata" : "Richiesta inviata"}
        </p>
        <h1 className="text-display text-3xl leading-tight md:text-4xl">{headline}</h1>
        <p className="text-sm text-muted-foreground">{subhead}</p>
      </div>

      <div className="w-full rounded-lg border bg-background p-4 text-sm">
        <div className="flex items-center justify-between border-b py-2">
          <span className="text-muted-foreground">Codice</span>
          <span className="font-mono text-xs">{booking.reference.slice(-8).toUpperCase()}</span>
        </div>
        <div className="flex items-center justify-between border-b py-2">
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" /> Data e ora
          </span>
          <span>{formatDateTime(booking.startsAt)}</span>
        </div>
        <div className="flex items-center justify-between border-b py-2">
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <Users className="h-3.5 w-3.5" /> Persone
          </span>
          <span>{booking.partySize}</span>
        </div>
        {booking.depositCents > 0 && (
          <div className="flex items-center justify-between py-2">
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <CreditCard className="h-3.5 w-3.5" /> Caparra
            </span>
            <span className={paymentHeld ? "text-emerald-600" : paymentFailed ? "text-rose-600" : ""}>
              {formatCurrency(booking.depositCents, venue.currency)}{" "}
              {paymentHeld ? "· trattenuta" : paymentFailed ? "· non riuscita" : ""}
            </span>
          </div>
        )}
      </div>

      <Button asChild variant="outline">
        <Link href={`/b/${params.slug}`}>Nuova prenotazione</Link>
      </Button>
    </div>
  );
}
