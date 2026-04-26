"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Trash2, Save, MapPin, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Booking = {
  reference: string;
  status: string;
  startsAt: string;
  partySize: number;
  notes: string | null;
  guest: { firstName: string; lastName: string | null; email: string | null } | null;
  venue: {
    name: string;
    slug: string;
    city: string | null;
    address: string | null;
    phone: string | null;
  };
};

const ERR_LABEL: Record<string, string> = {
  not_found: "Prenotazione non trovata.",
  locked: "Questa prenotazione non è più modificabile.",
  already_closed: "La prenotazione è già stata chiusa.",
  too_late: "Mancano meno di 2 ore: contatta il locale per modifiche.",
  slot_unavailable: "Slot non disponibile, prova un altro orario.",
  invalid_datetime: "Data o ora non valida.",
  rate_limited: "Hai fatto troppe richieste, riprova tra poco.",
  invalid_input: "Controlla i campi.",
};

function toDateInput(iso: string) {
  const d = new Date(iso);
  return d.toISOString().slice(0, 10);
}

function toTimeInput(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function BookingManageForm({ booking }: { booking: Booking }) {
  const router = useRouter();
  const closed =
    booking.status === "COMPLETED" ||
    booking.status === "CANCELLED" ||
    booking.status === "NO_SHOW";
  const [busy, setBusy] = useState<"save" | "cancel" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy("save");
    setError(null);
    setMessage(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      partySize: Number(fd.get("partySize")),
      date: String(fd.get("date")),
      time: String(fd.get("time")),
      notes: String(fd.get("notes") ?? ""),
    };
    const res = await fetch(`/api/bookings/manage/${booking.reference}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(null);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(ERR_LABEL[b.error as string] ?? "Modifica non riuscita.");
      return;
    }
    setMessage("Aggiornato. Lo staff riceve una notifica.");
    router.refresh();
  }

  async function onCancel() {
    if (!confirm("Confermi l'annullamento?")) return;
    setBusy("cancel");
    setError(null);
    setMessage(null);
    const res = await fetch(`/api/bookings/manage/${booking.reference}`, {
      method: "DELETE",
    });
    setBusy(null);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(ERR_LABEL[b.error as string] ?? "Annullamento non riuscito.");
      return;
    }
    setMessage("Prenotazione annullata. Riceverai una conferma via email.");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          La tua prenotazione
        </p>
        <h1 className="text-display text-3xl">{booking.venue.name}</h1>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {booking.venue.address && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {[booking.venue.address, booking.venue.city].filter(Boolean).join(" · ")}
            </span>
          )}
          {booking.venue.phone && (
            <span className="inline-flex items-center gap-1">
              <Phone className="h-3.5 w-3.5" />
              {booking.venue.phone}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Codice <span className="font-mono">{booking.reference.slice(-8).toUpperCase()}</span>
          {booking.guest && (
            <>
              {" · "}A nome di {booking.guest.firstName}
              {booking.guest.lastName ? ` ${booking.guest.lastName}` : ""}
            </>
          )}
        </p>
      </header>

      {closed && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Questa prenotazione è in stato <strong>{booking.status}</strong>: non puoi più
          modificarla. Per assistenza contatta il locale.
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border bg-background p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="bm-party">Persone</Label>
            <Input
              id="bm-party"
              name="partySize"
              type="number"
              min={1}
              max={20}
              defaultValue={booking.partySize}
              disabled={closed}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bm-date">Data</Label>
            <Input
              id="bm-date"
              name="date"
              type="date"
              defaultValue={toDateInput(booking.startsAt)}
              disabled={closed}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bm-time">Ora</Label>
            <Input
              id="bm-time"
              name="time"
              type="time"
              defaultValue={toTimeInput(booking.startsAt)}
              disabled={closed}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bm-notes">Note per il locale</Label>
          <Textarea
            id="bm-notes"
            name="notes"
            rows={3}
            defaultValue={booking.notes ?? ""}
            disabled={closed}
            maxLength={500}
            placeholder="Allergie, occasione, posto preferito…"
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {message && <p className="text-sm text-emerald-700">{message}</p>}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={busy !== null || closed}
          >
            <Trash2 className="h-4 w-4" /> Annulla prenotazione
          </Button>
          <Button type="submit" variant="gold" disabled={busy !== null || closed}>
            <Save className="h-4 w-4" />
            {busy === "save" ? "Salvataggio…" : "Salva modifiche"}
          </Button>
        </div>
      </form>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <CalendarClock className="h-3.5 w-3.5" />
        Le modifiche sono possibili fino a 2 ore prima dell&apos;orario.
      </p>
    </div>
  );
}
