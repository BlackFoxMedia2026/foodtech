"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Utensils,
  XCircle,
  PhoneOff,
  RotateCcw,
  Trash2,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Status = "PENDING" | "CONFIRMED" | "ARRIVED" | "SEATED" | "COMPLETED" | "NO_SHOW" | "CANCELLED";

type Initial = {
  id: string;
  status: Status;
  partySize: number;
  startsAt: string;
  durationMin: number;
  tableId: string | null;
  notes: string | null;
  internalNotes: string | null;
  occasion: string | null;
  depositCents: number;
};

type TableOpt = { id: string; label: string; seats: number };

export function BookingActions({
  booking,
  tables,
  canSeePrivate,
}: {
  booking: Initial;
  tables: TableOpt[];
  canSeePrivate: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  async function patch(payload: Partial<Initial>) {
    setBusy(true);
    const res = await fetch(`/api/bookings/${booking.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (res.ok) startTransition(() => router.refresh());
    else alert("Operazione non riuscita.");
  }

  async function remove() {
    if (!confirm("Eliminare la prenotazione? L'azione è irreversibile.")) return;
    setBusy(true);
    const res = await fetch(`/api/bookings/${booking.id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) router.push("/bookings");
    else alert("Eliminazione non riuscita.");
  }

  const isClosed = booking.status === "COMPLETED" || booking.status === "CANCELLED" || booking.status === "NO_SHOW";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!isClosed && booking.status === "PENDING" && (
        <Button variant="gold" size="sm" disabled={busy} onClick={() => patch({ status: "CONFIRMED" })}>
          <CheckCircle2 className="h-4 w-4" /> Conferma
        </Button>
      )}
      {!isClosed && booking.status !== "ARRIVED" && booking.status !== "SEATED" && (
        <Button variant="subtle" size="sm" disabled={busy} onClick={() => patch({ status: "ARRIVED" })}>
          <CheckCircle2 className="h-4 w-4" /> Arrivato
        </Button>
      )}
      {!isClosed && booking.status === "ARRIVED" && (
        <Button variant="subtle" size="sm" disabled={busy} onClick={() => patch({ status: "SEATED" })}>
          <Utensils className="h-4 w-4" /> Seduto
        </Button>
      )}
      {!isClosed && (
        <Button variant="subtle" size="sm" disabled={busy} onClick={() => patch({ status: "COMPLETED" })}>
          <CheckCircle2 className="h-4 w-4" /> Chiudi tavolo
        </Button>
      )}
      {!isClosed && (
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => patch({ status: "NO_SHOW" })}>
          <PhoneOff className="h-4 w-4" /> No-show
        </Button>
      )}
      {!isClosed && (
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => patch({ status: "CANCELLED" })}>
          <XCircle className="h-4 w-4" /> Cancella
        </Button>
      )}
      {isClosed && (
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => patch({ status: "CONFIRMED" })}>
          <RotateCcw className="h-4 w-4" /> Riapri
        </Button>
      )}

      <EditBookingDialog booking={booking} tables={tables} canSeePrivate={canSeePrivate} onSave={patch} busy={busy} />

      <Button variant="ghost" size="sm" disabled={busy} onClick={remove}>
        <Trash2 className="h-4 w-4" /> Elimina
      </Button>
    </div>
  );
}

function EditBookingDialog({
  booking,
  tables,
  canSeePrivate,
  onSave,
  busy,
}: {
  booking: Initial;
  tables: TableOpt[];
  canSeePrivate: boolean;
  onSave: (payload: Partial<Initial>) => Promise<void>;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const start = new Date(booking.startsAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  const dateStr = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
  const timeStr = `${pad(start.getHours())}:${pad(start.getMinutes())}`;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const date = String(fd.get("date"));
    const time = String(fd.get("time"));
    const payload: Partial<Initial> = {
      partySize: Number(fd.get("partySize")),
      durationMin: Number(fd.get("durationMin")),
      startsAt: new Date(`${date}T${time}`).toISOString(),
      tableId: (fd.get("tableId") as string) || null,
      notes: String(fd.get("notes") ?? "").trim() || null,
    };
    if (canSeePrivate) {
      payload.internalNotes = String(fd.get("internalNotes") ?? "").trim() || null;
    }
    const occasion = String(fd.get("occasion") ?? "");
    payload.occasion = occasion || null;
    await onSave(payload);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="h-4 w-4" /> Modifica
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Modifica prenotazione</DialogTitle>
          <DialogDescription>Cambia data/ora, persone, tavolo e note.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="bk-date">Data</Label>
              <Input id="bk-date" name="date" type="date" defaultValue={dateStr} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bk-time">Ora</Label>
              <Input id="bk-time" name="time" type="time" defaultValue={timeStr} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bk-party">Persone</Label>
              <Input id="bk-party" name="partySize" type="number" min={1} max={50} defaultValue={booking.partySize} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bk-dur">Durata (min)</Label>
              <Input id="bk-dur" name="durationMin" type="number" min={15} max={480} defaultValue={booking.durationMin} required />
            </div>
            <div className="space-y-1.5">
              <Label>Tavolo</Label>
              <Select name="tableId" defaultValue={booking.tableId ?? ""}>
                <SelectTrigger>
                  <SelectValue placeholder="Da assegnare" />
                </SelectTrigger>
                <SelectContent>
                  {tables.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label} · {t.seats} posti
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Occasione</Label>
              <Select name="occasion" defaultValue={booking.occasion ?? ""}>
                <SelectTrigger>
                  <SelectValue placeholder="Nessuna" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BIRTHDAY">Compleanno</SelectItem>
                  <SelectItem value="ANNIVERSARY">Anniversario</SelectItem>
                  <SelectItem value="BUSINESS">Lavoro</SelectItem>
                  <SelectItem value="DATE">Romantica</SelectItem>
                  <SelectItem value="CELEBRATION">Celebrazione</SelectItem>
                  <SelectItem value="OTHER">Altro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bk-notes">Note pubbliche</Label>
            <Textarea id="bk-notes" name="notes" rows={3} defaultValue={booking.notes ?? ""} />
          </div>
          {canSeePrivate && (
            <div className="space-y-1.5">
              <Label htmlFor="bk-int">Note interne (solo Manager)</Label>
              <Textarea id="bk-int" name="internalNotes" rows={2} defaultValue={booking.internalNotes ?? ""} />
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Annulla
            </Button>
            <Button type="submit" variant="gold" disabled={busy}>
              {busy ? "Salvataggio…" : "Salva"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
