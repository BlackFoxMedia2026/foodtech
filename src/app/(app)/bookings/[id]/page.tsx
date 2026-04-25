import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Users, Clock, Phone, Mail, NotebookText, CreditCard } from "lucide-react";
import { db } from "@/lib/db";
import { can, getActiveVenue } from "@/lib/tenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge, SourceBadge } from "@/components/bookings/status-badge";
import { BookingActions } from "@/components/bookings/booking-actions";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  DEPOSIT: "Caparra",
  PREAUTH: "Preautorizzazione",
  TICKET: "Ticket",
  REFUND: "Rimborso",
  PACKAGE: "Pacchetto",
};

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  PENDING: "warning",
  SUCCEEDED: "success",
  FAILED: "danger",
  REFUNDED: "neutral",
};

export default async function BookingDetail({ params }: { params: { id: string } }) {
  const ctx = await getActiveVenue();
  const item = await db.booking.findFirst({
    where: { id: params.id, venueId: ctx.venueId },
    include: { guest: true, table: true, payments: { orderBy: { createdAt: "desc" } } },
  });
  if (!item) notFound();
  const canSeePrivate = can(ctx.role, "view_private");

  const tables = await db.table.findMany({
    where: { venueId: ctx.venueId, active: true },
    select: { id: true, label: true, seats: true },
    orderBy: { label: "asc" },
  });

  const guestName = item.guest ? `${item.guest.firstName} ${item.guest.lastName ?? ""}`.trim() : "Walk-in";

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/bookings">
            <ArrowLeft className="h-4 w-4" /> Tutte le prenotazioni
          </Link>
        </Button>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Prenotazione</p>
          <h1 className="text-display text-3xl">{guestName}</h1>
          <p className="text-sm text-muted-foreground">{formatDateTime(item.startsAt)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SourceBadge source={item.source} />
          <StatusBadge status={item.status} />
        </div>
      </header>

      <BookingActions
        booking={{
          id: item.id,
          status: item.status,
          partySize: item.partySize,
          startsAt: item.startsAt.toISOString(),
          durationMin: item.durationMin,
          tableId: item.tableId,
          notes: item.notes,
          internalNotes: canSeePrivate ? item.internalNotes : null,
          occasion: item.occasion,
          depositCents: item.depositCents,
        }}
        tables={tables}
        canSeePrivate={canSeePrivate}
      />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Dettagli servizio</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <Info icon={Users} label="Persone" value={String(item.partySize)} />
            <Info icon={Clock} label="Durata" value={`${item.durationMin} min`} />
            <Info label="Tavolo" value={item.table?.label ?? "Da assegnare"} />
            <Info label="Occasione" value={item.occasion ?? "—"} />
            {item.depositCents > 0 && (
              <Info
                label="Caparra"
                value={`${formatCurrency(item.depositCents, ctx.venue.currency)} · ${item.depositStatus}`}
              />
            )}
            <Info label="Riferimento" value={item.reference.slice(0, 10)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ospite</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-base font-medium">{guestName}</p>
            {item.guest?.phone && (
              <p className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4" /> {item.guest.phone}
              </p>
            )}
            {item.guest?.email && (
              <p className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" /> {item.guest.email}
              </p>
            )}
            {item.guest && (
              <div className="flex flex-wrap gap-2">
                <Badge tone="gold">{item.guest.loyaltyTier}</Badge>
                <Badge tone="neutral">{item.guest.totalVisits} visite</Badge>
                {item.guest.allergies && <Badge tone="danger">{item.guest.allergies}</Badge>}
              </div>
            )}
            {item.guest && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/guests/${item.guest.id}`}>Apri scheda CRM</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {(item.notes || (canSeePrivate && item.internalNotes)) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <NotebookText className="h-4 w-4" /> Note
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {item.notes && <p>{item.notes}</p>}
            {canSeePrivate && item.internalNotes && (
              <p className="rounded-md bg-secondary px-3 py-2 text-muted-foreground">
                Interno: {item.internalNotes}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {item.payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" /> Movimenti di pagamento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {item.payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="font-medium">{KIND_LABEL[p.kind] ?? p.kind}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(p.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">{formatCurrency(p.amountCents, p.currency)}</p>
                  <Badge tone={STATUS_TONE[p.status] ?? "neutral"}>{p.status}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Info({ icon: Icon, label, value }: { icon?: React.ElementType; label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 flex items-center gap-2 text-base">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        {value}
      </p>
    </div>
  );
}
