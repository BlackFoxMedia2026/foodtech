"use client";

import { useState } from "react";
import Link from "next/link";
import type { Booking, Guest, Table } from "@prisma/client";
import {
  CheckCircle2,
  ExternalLink,
  Phone,
  PhoneOff,
  RotateCcw,
  StickyNote,
  Utensils,
  Users,
  XCircle,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
} from "@/components/ui/sheet";
import { StatusPill, type BookingStatusKey } from "@/components/ui/status-pill";
import { formatTime, initials } from "@/lib/utils";

type BookingRow = Booking & { guest: Guest | null; table: Table | null };

const OCCASION_LABEL: Record<string, string> = {
  BIRTHDAY: "Compleanno",
  ANNIVERSARY: "Anniversario",
  BUSINESS: "Lavoro",
  DATE: "Romantica",
  CELEBRATION: "Celebrazione",
  OTHER: "Altro",
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

export function BookingDetailSheet({
  booking,
  onOpenChange,
  onChanged,
}: {
  booking: BookingRow | null;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);

  if (!booking) {
    return <Sheet open={false} onOpenChange={onOpenChange} />;
  }

  const name = booking.guest
    ? `${booking.guest.firstName} ${booking.guest.lastName ?? ""}`.trim()
    : "Walk-in";
  const isClosed =
    booking.status === "COMPLETED" ||
    booking.status === "CANCELLED" ||
    booking.status === "NO_SHOW";

  async function patch(status: string) {
    setBusy(true);
    const res = await fetch(`/api/bookings/${booking!.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusy(false);
    if (res.ok) onChanged();
  }

  const startDate = new Date(booking.startsAt);

  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader
          title={name}
          description={
            booking.guest?.email
              ? booking.guest.email
              : booking.guest?.phone
                ? booking.guest.phone
                : "Senza contatti"
          }
          action={
            <Link
              href={`/bookings/${booking.id}`}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-secondary transition hover:bg-secondary hover:text-foreground"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Pagina completa
            </Link>
          }
        />
        <SheetBody className="space-y-6">
          {/* Hero with avatar + status */}
          <div className="flex items-start gap-4">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="text-display text-sm">{initials(name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status={booking.status as BookingStatusKey} />
                {booking.occasion && (
                  <span className="inline-flex items-center rounded-full bg-status-vip-soft px-2 py-0.5 text-xs font-medium text-status-vip">
                    {OCCASION_LABEL[booking.occasion] ?? booking.occasion}
                  </span>
                )}
              </div>
              <p className="mt-2 text-display text-2xl font-medium">
                {formatTime(booking.startsAt)}
              </p>
              <p className="text-xs text-secondary capitalize">
                {startDate.toLocaleDateString("it-IT", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </p>
            </div>
          </div>

          {/* Quick facts grid */}
          <div className="grid grid-cols-2 gap-3">
            <Fact
              icon={<Users className="h-4 w-4 text-tertiary" />}
              label="Persone"
              value={String(booking.partySize)}
            />
            <Fact
              icon={<Utensils className="h-4 w-4 text-tertiary" />}
              label="Tavolo"
              value={booking.table?.label ?? "Da assegnare"}
            />
            <Fact
              icon={<Phone className="h-4 w-4 text-tertiary" />}
              label="Fonte"
              value={SOURCE_LABEL[booking.source] ?? booking.source}
            />
            <Fact
              icon={<StickyNote className="h-4 w-4 text-tertiary" />}
              label="Durata"
              value={`${booking.durationMin} min`}
            />
          </div>

          {/* Notes */}
          {booking.notes && (
            <div className="panel-sunken px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-tertiary">
                Note ospite
              </p>
              <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">{booking.notes}</p>
            </div>
          )}

          {/* Guest link */}
          {booking.guest && (
            <Link
              href={`/guests/${booking.guest.id}`}
              className="group flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5 transition hover:border-border-strong"
            >
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-tertiary">
                  Profilo ospite
                </p>
                <p className="text-sm font-medium">{name}</p>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-tertiary transition group-hover:text-foreground" />
            </Link>
          )}
        </SheetBody>

        <SheetFooter className="flex-col gap-2 sm:flex-col sm:items-stretch">
          {isClosed ? (
            <Button variant="outline" disabled={busy} onClick={() => patch("CONFIRMED")}>
              <RotateCcw className="h-4 w-4" /> Riapri prenotazione
            </Button>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                {booking.status === "PENDING" && (
                  <Button
                    variant="gold"
                    disabled={busy}
                    onClick={() => patch("CONFIRMED")}
                    className="col-span-2"
                  >
                    <CheckCircle2 className="h-4 w-4" /> Conferma prenotazione
                  </Button>
                )}
                {booking.status !== "ARRIVED" && booking.status !== "SEATED" && (
                  <Button variant="default" disabled={busy} onClick={() => patch("ARRIVED")}>
                    <CheckCircle2 className="h-4 w-4" /> Arrivato
                  </Button>
                )}
                {booking.status === "ARRIVED" && (
                  <Button variant="default" disabled={busy} onClick={() => patch("SEATED")}>
                    <Utensils className="h-4 w-4" /> Al tavolo
                  </Button>
                )}
                {(booking.status === "ARRIVED" || booking.status === "SEATED") && (
                  <Button variant="subtle" disabled={busy} onClick={() => patch("COMPLETED")}>
                    <CheckCircle2 className="h-4 w-4" /> Chiudi
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="ghost" disabled={busy} onClick={() => patch("NO_SHOW")}>
                  <PhoneOff className="h-4 w-4" /> No-show
                </Button>
                <Button variant="ghost" disabled={busy} onClick={() => patch("CANCELLED")}>
                  <XCircle className="h-4 w-4" /> Annulla
                </Button>
              </div>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Fact({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="panel-sunken px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-tertiary">
        {icon} {label}
      </div>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
