"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Trash2, Save, MapPin, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { t, type Locale } from "@/lib/i18n";

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

const ERR_KEY: Record<string, string> = {
  not_found: "manage.error.not_found",
  locked: "manage.error.locked",
  already_closed: "manage.error.already_closed",
  too_late: "manage.error.too_late",
  slot_unavailable: "manage.error.slot_unavailable",
  invalid_datetime: "manage.error.invalid_datetime",
  rate_limited: "manage.error.rate_limited",
  invalid_input: "manage.error.invalid_input",
};

function toDateInput(iso: string) {
  const d = new Date(iso);
  return d.toISOString().slice(0, 10);
}

function toTimeInput(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function BookingManageForm({
  booking,
  locale,
}: {
  booking: Booking;
  locale: Locale;
}) {
  const router = useRouter();
  const tr = (key: string, vars?: Record<string, string | number>) =>
    t(locale, key as never, vars);
  const closed =
    booking.status === "COMPLETED" ||
    booking.status === "CANCELLED" ||
    booking.status === "NO_SHOW";
  const [busy, setBusy] = useState<"save" | "cancel" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function lookupError(code: string | undefined, fallback: string): string {
    const key = code ? ERR_KEY[code] : null;
    if (key) return tr(key);
    return tr(fallback);
  }

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
      setError(lookupError(b.error as string | undefined, "manage.error.update_failed"));
      return;
    }
    setMessage(tr("manage.updated"));
    router.refresh();
  }

  async function onCancel() {
    if (!confirm(tr("manage.confirmCancel"))) return;
    setBusy("cancel");
    setError(null);
    setMessage(null);
    const res = await fetch(`/api/bookings/manage/${booking.reference}`, {
      method: "DELETE",
    });
    setBusy(null);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(lookupError(b.error as string | undefined, "manage.error.cancel_failed"));
      return;
    }
    setMessage(tr("manage.cancelled"));
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          {tr("manage.kicker")}
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
          {tr("manage.code")}{" "}
          <span className="font-mono">{booking.reference.slice(-8).toUpperCase()}</span>
          {booking.guest && (
            <>
              {" · "}
              {tr("manage.bookedAs", {
                name: [booking.guest.firstName, booking.guest.lastName]
                  .filter(Boolean)
                  .join(" "),
              })}
            </>
          )}
        </p>
      </header>

      {closed && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {tr("manage.statusClosed", { status: booking.status })}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border bg-background p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="bm-party">{tr("manage.party")}</Label>
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
            <Label htmlFor="bm-date">{tr("manage.date")}</Label>
            <Input
              id="bm-date"
              name="date"
              type="date"
              defaultValue={toDateInput(booking.startsAt)}
              disabled={closed}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bm-time">{tr("manage.time")}</Label>
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
          <Label htmlFor="bm-notes">{tr("manage.notes")}</Label>
          <Textarea
            id="bm-notes"
            name="notes"
            rows={3}
            defaultValue={booking.notes ?? ""}
            disabled={closed}
            maxLength={500}
            placeholder={tr("manage.notesPlaceholder")}
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
            <Trash2 className="h-4 w-4" /> {tr("manage.cancel")}
          </Button>
          <Button type="submit" variant="gold" disabled={busy !== null || closed}>
            <Save className="h-4 w-4" />
            {busy === "save" ? tr("manage.saving") : tr("manage.save")}
          </Button>
        </div>
      </form>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <CalendarClock className="h-3.5 w-3.5" />
        {tr("manage.lockNote")}
      </p>
    </div>
  );
}
