import { notFound } from "next/navigation";
import { CalendarClock, MapPin, Ticket as TicketIcon } from "lucide-react";
import { db } from "@/lib/db";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TicketPage({ params }: { params: { id: string } }) {
  const ticket = await db.ticket.findUnique({
    where: { id: params.id },
    include: {
      experience: {
        include: {
          venue: {
            select: {
              name: true,
              address: true,
              city: true,
              currency: true,
            },
          },
        },
      },
    },
  });
  if (!ticket) notFound();

  // QR encodes the ticket id; venue staff scans/keys it in the scanner
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&format=svg&margin=10&data=${encodeURIComponent(ticket.id)}`;

  const checked = ticket.status === "CHECKED_IN";
  const cancelled = ticket.status === "CANCELLED" || ticket.status === "REFUNDED";

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-6 py-10 text-center">
      <header className="flex w-full justify-start text-sm text-muted-foreground">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-carbon-800 text-sand-50 font-display text-xs">
          T
        </span>
        <span className="ml-2 self-center">Tavolo · ticket</span>
      </header>

      <p className="text-xs uppercase tracking-[0.18em] text-gilt-dark">
        {ticket.experience.venue.name}
      </p>
      <h1 className="text-display text-3xl leading-tight">{ticket.experience.title}</h1>

      <div className="rounded-2xl border bg-background p-4 shadow-sm">
        {cancelled ? (
          <p className="px-6 py-12 text-sm text-rose-600">Ticket annullato.</p>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qrSrc}
            alt="QR ticket"
            className={`h-64 w-64 ${checked ? "opacity-30" : ""}`}
          />
        )}
      </div>

      {checked && (
        <p className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Check-in effettuato {ticket.checkedInAt && `il ${formatDateTime(ticket.checkedInAt)}`}.
        </p>
      )}

      <div className="w-full rounded-lg border bg-background p-4 text-left text-sm">
        <div className="flex items-center justify-between border-b py-2">
          <span className="text-muted-foreground">Codice</span>
          <span className="font-mono text-xs">{ticket.id.slice(-10).toUpperCase()}</span>
        </div>
        <div className="flex items-center justify-between border-b py-2">
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" /> Quando
          </span>
          <span>{formatDateTime(ticket.experience.startsAt)}</span>
        </div>
        {(ticket.experience.venue.address || ticket.experience.venue.city) && (
          <div className="flex items-center justify-between border-b py-2">
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" /> Dove
            </span>
            <span className="text-right text-xs">
              {[ticket.experience.venue.address, ticket.experience.venue.city]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between border-b py-2">
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <TicketIcon className="h-3.5 w-3.5" /> Quantità
          </span>
          <span>{ticket.quantity}</span>
        </div>
        {ticket.totalCents > 0 && (
          <div className="flex items-center justify-between py-2">
            <span className="text-muted-foreground">Totale</span>
            <span>{formatCurrency(ticket.totalCents, ticket.experience.venue.currency)}</span>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Mostra questo QR allo staff per il check-in. Il codice è personale.
      </p>
    </div>
  );
}
