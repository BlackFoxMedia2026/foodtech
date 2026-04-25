import Link from "next/link";
import { CheckCircle2, AlertTriangle, CalendarClock, Users, Ticket as TicketIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { getTicket } from "@/server/tickets";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function TicketDonePage({
  params,
  searchParams,
}: {
  params: { slug: string; exp: string };
  searchParams: { t?: string; canceled?: string };
}) {
  if (!searchParams.t) notFound();
  const ticket = await getTicket(searchParams.t);
  if (!ticket) notFound();

  const failed = searchParams.canceled === "1" || ticket.status === "CANCELLED";

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-6 px-6 py-10 text-center">
      <span
        className={
          failed
            ? "grid h-14 w-14 place-items-center rounded-full bg-rose-100 text-rose-600"
            : "grid h-14 w-14 place-items-center rounded-full bg-gilt/15 text-gilt-dark"
        }
      >
        {failed ? <AlertTriangle className="h-7 w-7" /> : <CheckCircle2 className="h-7 w-7" />}
      </span>
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.18em] text-gilt-dark">
          {failed ? "Pagamento non riuscito" : "Ticket confermato"}
        </p>
        <h1 className="text-display text-3xl leading-tight md:text-4xl">
          {failed
            ? "Riprova quando vuoi"
            : `${ticket.buyerName.split(" ")[0]}, ci vediamo presto.`}
        </h1>
        <p className="text-sm text-muted-foreground">
          {ticket.experience.title} · {ticket.experience.venue.name}
        </p>
      </div>

      <div className="w-full rounded-lg border bg-background p-4 text-sm">
        <div className="flex items-center justify-between border-b py-2">
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" /> Quando
          </span>
          <span>{formatDateTime(ticket.experience.startsAt)}</span>
        </div>
        <div className="flex items-center justify-between border-b py-2">
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <Users className="h-3.5 w-3.5" /> Quantità
          </span>
          <span>{ticket.quantity}</span>
        </div>
        <div className="flex items-center justify-between py-2">
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <TicketIcon className="h-3.5 w-3.5" /> Totale
          </span>
          <span>
            {ticket.totalCents === 0
              ? "Gratis"
              : formatCurrency(ticket.totalCents, ticket.experience.venue.currency)}
          </span>
        </div>
      </div>

      <Button asChild variant="outline">
        <Link href={`/e/${params.slug}/${params.exp}`}>Torna all&apos;evento</Link>
      </Button>
    </div>
  );
}
