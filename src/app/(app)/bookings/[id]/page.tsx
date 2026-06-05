import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  ChefHat,
  Clock,
  CreditCard,
  Crown,
  Hourglass,
  Mail,
  NotebookText,
  Phone,
  Sparkles,
  Tag,
  Users,
} from "lucide-react";
import { db } from "@/lib/db";
import { can, getActiveVenue } from "@/lib/tenant";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import {
  StatusPill,
  LoyaltyPill,
  type BookingStatusKey,
  type LoyaltyKey,
} from "@/components/ui/status-pill";
import { BookingActions } from "@/components/bookings/booking-actions";
import { BookingTimeline } from "@/components/bookings/booking-timeline";
import { PreorderEditor } from "@/components/preorders/preorder-editor";
import { getPreorderForBooking, venueMenuForPreorder } from "@/server/preorders";
import {
  formatCurrency,
  formatDateTime,
  formatTime,
  initials,
} from "@/lib/utils";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  DEPOSIT: "Caparra",
  PREAUTH: "Preautorizzazione",
  TICKET: "Ticket",
  REFUND: "Rimborso",
  PACKAGE: "Pacchetto",
};

const PAYMENT_TONE: Record<string, string> = {
  PENDING: "text-status-pending bg-status-pending-soft",
  SUCCEEDED: "text-status-confirmed bg-status-confirmed-soft",
  FAILED: "text-status-no-show bg-status-no-show-soft",
  REFUNDED: "text-secondary bg-secondary",
};

const SOURCE_LABEL: Record<string, string> = {
  PHONE: "Telefono",
  WIDGET: "Widget sito",
  WALK_IN: "Walk-in",
  GOOGLE: "Google",
  SOCIAL: "Social",
  CONCIERGE: "Concierge",
  EVENT: "Evento",
};

const OCCASION_LABEL: Record<string, string> = {
  BIRTHDAY: "Compleanno",
  ANNIVERSARY: "Anniversario",
  BUSINESS: "Lavoro",
  DATE: "Romantica",
  CELEBRATION: "Celebrazione",
  OTHER: "Altro",
};

export default async function BookingDetail({ params }: { params: { id: string } }) {
  const ctx = await getActiveVenue();
  const item = await db.booking.findFirst({
    where: { id: params.id, venueId: ctx.venueId },
    include: {
      guest: true,
      table: true,
      payments: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!item) notFound();

  // Combine tables: carica i tavoli aggiuntivi nello stesso ordine
  // dichiarato in `combinedTableIds` per renderizzarli come chip ordinati.
  const combinedTables =
    item.combinedTableIds.length > 0
      ? await db.table
          .findMany({
            where: {
              id: { in: item.combinedTableIds },
              venueId: ctx.venueId,
            },
            select: { id: true, label: true, seats: true },
          })
          .then((rows) =>
            item.combinedTableIds
              .map((id) => rows.find((r) => r.id === id))
              .filter((r): r is { id: string; label: string; seats: number } =>
                Boolean(r),
              ),
          )
      : [];
  const totalSeatsCombined =
    (item.table?.seats ?? 0) +
    combinedTables.reduce((s, t) => s + t.seats, 0);
  const canSeePrivate = can(ctx.role, "view_private");

  const tables = await db.table.findMany({
    where: { venueId: ctx.venueId, active: true },
    select: { id: true, label: true, seats: true },
    orderBy: { label: "asc" },
  });

  const [preorder, menu] = await Promise.all([
    getPreorderForBooking(item.id),
    venueMenuForPreorder(ctx.venueId),
  ]);

  const guestName = item.guest
    ? `${item.guest.firstName} ${item.guest.lastName ?? ""}`.trim()
    : "Walk-in";

  const isVip =
    item.guest?.loyaltyTier === "VIP" ||
    item.guest?.loyaltyTier === "AMBASSADOR";

  return (
    <div className="space-y-6 animate-fade-in">
      <Link
        href="/bookings"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-secondary transition hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Tutte le prenotazioni
      </Link>

      {/* HERO booking */}
      <section className="rounded-2xl border border-white/8 bg-carbon-800 p-6 text-sand-50 shadow-elevated">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-5">
            <Avatar className="h-16 w-16 shrink-0">
              <AvatarFallback className="bg-white/10 text-display text-lg font-medium text-sand-50">
                {initials(guestName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-gilt-light">
                Prenotazione · {SOURCE_LABEL[item.source] ?? item.source}
              </p>
              <h1 className="text-display mt-1 flex items-center gap-2 text-[34px] font-medium leading-tight tracking-tight">
                {guestName}
                {isVip && <Crown className="h-5 w-5 text-gilt-light" />}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-sand-50/70">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-sand-50/50" />
                  <span className="capitalize">
                    {new Date(item.startsAt).toLocaleDateString("it-IT", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-sand-50/50" />
                  <span className="text-numeric font-medium text-sand-50">
                    {formatTime(item.startsAt)}
                  </span>{" "}
                  · {item.durationMin}m
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-sand-50/50" />
                  <span className="text-numeric font-medium text-sand-50">
                    {item.partySize}
                  </span>{" "}
                  pers
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={item.status as BookingStatusKey} />
            {item.occasion && (
              <span className="inline-flex items-center gap-1 rounded-full bg-gilt/15 px-2.5 py-0.5 text-xs font-medium text-gilt-light">
                <Sparkles className="h-3 w-3" />
                {OCCASION_LABEL[item.occasion] ?? item.occasion}
              </span>
            )}
            {item.guest && (
              <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10.5px] font-mono text-sand-50/70">
                #{item.reference.slice(0, 8)}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Action bar */}
      <Panel>
        <PanelBody className="pt-5">
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
        </PanelBody>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Service details */}
        <Panel>
          <PanelHeader title="Dettagli servizio" description="Sintesi operativa" />
          <PanelBody className="grid grid-cols-2 gap-4 pt-0">
            <InfoTile
              icon={<Users className="h-4 w-4 text-tertiary" />}
              label="Persone"
              value={String(item.partySize)}
            />
            <InfoTile
              icon={<Clock className="h-4 w-4 text-tertiary" />}
              label="Durata"
              value={`${item.durationMin} min`}
            />
            {combinedTables.length > 0 ? (
              <div
                className="panel-sunken px-3 py-2.5"
                title={`${totalSeatsCombined} posti totali per gruppo da ${item.partySize}`}
              >
                <div className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.14em] text-tertiary">
                  <Tag className="h-4 w-4 text-tertiary" /> Tavoli combinati
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  <span className="rounded-full bg-gilt/20 px-2 py-0.5 text-[12px] font-medium text-gilt-light">
                    {item.table?.label ?? "—"}
                  </span>
                  {combinedTables.map((t) => (
                    <span
                      key={t.id}
                      className="inline-flex items-center gap-1 text-[12px] font-medium text-gilt-light"
                    >
                      <span className="text-tertiary">+</span>
                      <span className="rounded-full bg-gilt/20 px-2 py-0.5">
                        {t.label}
                      </span>
                    </span>
                  ))}
                  <span className="ml-1 text-[11px] text-tertiary text-numeric">
                    {totalSeatsCombined} posti
                  </span>
                </div>
              </div>
            ) : (
              <InfoTile
                icon={<Tag className="h-4 w-4 text-tertiary" />}
                label="Tavolo"
                value={item.table?.label ?? "Da assegnare"}
                tone={item.table ? undefined : "warning"}
              />
            )}
            <InfoTile
              icon={<Sparkles className="h-4 w-4 text-tertiary" />}
              label="Occasione"
              value={
                item.occasion
                  ? OCCASION_LABEL[item.occasion] ?? item.occasion
                  : "—"
              }
            />
            {item.depositCents > 0 && (
              <InfoTile
                icon={<CreditCard className="h-4 w-4 text-tertiary" />}
                label="Caparra"
                value={`${formatCurrency(item.depositCents, ctx.venue.currency)} · ${item.depositStatus}`}
              />
            )}
            {item.isGroup && (
              <InfoTile
                icon={<Hourglass className="h-4 w-4 text-tertiary" />}
                label="Evento gruppo"
                value={`${item.eventType ?? "—"}${
                  item.budgetCents
                    ? ` · ${formatCurrency(item.budgetCents, ctx.venue.currency)}/pax`
                    : ""
                }`}
              />
            )}
          </PanelBody>
        </Panel>

        {/* Guest panel */}
        <Panel>
          <PanelHeader
            title="Ospite"
            description={item.guest ? "Profilo CRM collegato" : "Walk-in senza profilo"}
            action={
              item.guest ? (
                <Link
                  href={`/guests/${item.guest.id}`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-secondary transition hover:text-foreground"
                >
                  Scheda CRM →
                </Link>
              ) : null
            }
          />
          <PanelBody className="space-y-3 pt-0 text-sm">
            <p className="text-base font-medium">{guestName}</p>
            <div className="space-y-1.5 text-[13px]">
              {item.guest?.phone && (
                <a
                  href={`tel:${item.guest.phone}`}
                  className="flex items-center gap-2 text-secondary transition hover:text-foreground"
                >
                  <Phone className="h-3.5 w-3.5 text-tertiary" /> {item.guest.phone}
                </a>
              )}
              {item.guest?.email && (
                <a
                  href={`mailto:${item.guest.email}`}
                  className="flex items-center gap-2 text-secondary transition hover:text-foreground"
                >
                  <Mail className="h-3.5 w-3.5 text-tertiary" /> {item.guest.email}
                </a>
              )}
            </div>
            {item.guest && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                <LoyaltyPill loyalty={item.guest.loyaltyTier as LoyaltyKey} />
                <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10.5px] font-medium">
                  {item.guest.totalVisits} visite
                </span>
                {item.guest.allergies && (
                  <span className="inline-flex items-center rounded-full bg-status-no-show-soft px-2 py-0.5 text-[10.5px] font-medium text-status-no-show">
                    ⚠ {item.guest.allergies}
                  </span>
                )}
              </div>
            )}
          </PanelBody>
        </Panel>
      </div>

      {/* Notes */}
      {(item.notes || (canSeePrivate && item.internalNotes)) && (
        <Panel>
          <PanelHeader
            title={
              <span className="inline-flex items-center gap-2">
                <NotebookText className="h-4 w-4 text-tertiary" /> Note
              </span>
            }
          />
          <PanelBody className="pt-0 space-y-2.5">
            {item.notes && (
              <div className="rounded-lg bg-[hsl(var(--surface-sunken))]/50 px-3 py-2.5">
                <p className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-tertiary">
                  Ospite
                </p>
                <p className="mt-1 text-sm whitespace-pre-wrap">{item.notes}</p>
              </div>
            )}
            {canSeePrivate && item.internalNotes && (
              <div className="rounded-lg border border-status-pending/20 bg-status-pending-soft/40 px-3 py-2.5">
                <p className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-status-pending">
                  Interno · solo Manager
                </p>
                <p className="mt-1 text-sm whitespace-pre-wrap">{item.internalNotes}</p>
              </div>
            )}
          </PanelBody>
        </Panel>
      )}

      {/* Preorder */}
      <Panel>
        <PanelHeader
          title={
            <span className="inline-flex items-center gap-2">
              <ChefHat className="h-4 w-4 text-tertiary" /> Pre-order
            </span>
          }
          description="Piatti già ordinati dall'ospite. Lo staff può aggiungere, correggere e marcare come pronto."
        />
        <PanelBody className="pt-0">
          <PreorderEditor
            scope="admin"
            bookingId={item.id}
            initial={
              preorder
                ? {
                    status: preorder.status,
                    notes: preorder.notes,
                    items: preorder.items.map((i) => ({
                      id: i.id,
                      menuItemId: i.menuItemId,
                      name: i.name,
                      priceCents: i.priceCents,
                      quantity: i.quantity,
                      notes: i.notes,
                    })),
                  }
                : null
            }
            menu={menu.map((c) => ({
              id: c.id,
              name: c.name,
              items: c.items.map((it) => ({
                id: it.id,
                name: it.name,
                description: it.description,
                priceCents: it.priceCents,
                currency: it.currency,
              })),
            }))}
            currency={ctx.venue.currency}
          />
        </PanelBody>
      </Panel>

      {/* Booking audit timeline */}
      <BookingTimeline bookingId={item.id} />

      {/* Payments */}
      {item.payments.length > 0 && (
        <Panel>
          <PanelHeader
            title={
              <span className="inline-flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-tertiary" /> Movimenti pagamento
              </span>
            }
            description={`${item.payments.length} ${item.payments.length === 1 ? "movimento" : "movimenti"}`}
          />
          <PanelBody className="space-y-2 pt-0">
            {item.payments.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-lg border border-border bg-[hsl(var(--surface-sunken))]/40 p-3"
              >
                <div>
                  <p className="text-sm font-medium">
                    {KIND_LABEL[p.kind] ?? p.kind}
                  </p>
                  <p className="text-[11px] text-tertiary">
                    {formatDateTime(p.createdAt)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-display text-numeric text-base font-medium">
                    {formatCurrency(p.amountCents, p.currency)}
                  </p>
                  <span
                    className={cn(
                      "mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-medium",
                      PAYMENT_TONE[p.status] ?? "bg-secondary text-secondary",
                    )}
                  >
                    {p.status}
                  </span>
                </div>
              </div>
            ))}
          </PanelBody>
        </Panel>
      )}
    </div>
  );
}

function InfoTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "warning";
}) {
  return (
    <div className="panel-sunken px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.14em] text-tertiary">
        {icon} {label}
      </div>
      <p
        className={cn(
          "mt-1 text-sm font-medium",
          tone === "warning" ? "text-status-pending" : "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}
