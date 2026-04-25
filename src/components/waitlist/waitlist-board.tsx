"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BellRing,
  CheckCircle2,
  Clock,
  Mail,
  Phone,
  Plus,
  Trash2,
  Users,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatTime } from "@/lib/utils";

type Active = {
  id: string;
  guestName: string;
  phone: string | null;
  email: string | null;
  partySize: number;
  expectedWaitMin: number;
  status: "WAITING" | "NOTIFIED" | "SEATED" | "CANCELLED" | "NO_SHOW";
  createdAt: string;
  notifiedAt: string | null;
  notes: string | null;
};

type Closed = {
  id: string;
  guestName: string;
  partySize: number;
  status: "SEATED" | "CANCELLED" | "NO_SHOW" | "WAITING" | "NOTIFIED";
  updatedAt: string;
};

type TableOpt = { id: string; label: string; seats: number };

export function WaitlistBoard({
  active,
  closed,
  tables,
}: {
  active: Active[];
  closed: Closed[];
  tables: TableOpt[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function patch(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    await fetch(`/api/waitlist/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusyId(null);
    startTransition(() => router.refresh());
  }

  async function notify(id: string) {
    setBusyId(id);
    await fetch(`/api/waitlist/${id}/notify`, { method: "POST" });
    setBusyId(null);
    startTransition(() => router.refresh());
  }

  async function seat(id: string, tableId: string | null) {
    setBusyId(id);
    await fetch(`/api/waitlist/${id}/seat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tableId }),
    });
    setBusyId(null);
    startTransition(() => router.refresh());
  }

  async function remove(id: string) {
    if (!confirm("Eliminare l'iscritto?")) return;
    setBusyId(id);
    await fetch(`/api/waitlist/${id}`, { method: "DELETE" });
    setBusyId(null);
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <AddDialog />
      </div>

      <div className="grid gap-3">
        {active.length === 0 ? (
          <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nessuno in attesa al momento.
          </p>
        ) : (
          active.map((a, i) => {
            const waited = Math.max(
              0,
              Math.round((Date.now() - new Date(a.createdAt).getTime()) / 60000),
            );
            const overdue = waited > a.expectedWaitMin + 10;
            return (
              <Card key={a.id} className={overdue ? "border-rose-400/60" : ""}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-secondary font-display">
                      #{i + 1}
                    </span>
                    <div>
                      <p className="text-base font-medium">
                        {a.guestName}
                        <Badge tone={a.status === "NOTIFIED" ? "info" : "neutral"} className="ml-2">
                          {a.status}
                        </Badge>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <Users className="mr-1 inline h-3 w-3" />
                        {a.partySize} pers ·{" "}
                        <Clock className="mr-1 inline h-3 w-3" />
                        attesa: {waited}m / stim. {a.expectedWaitMin}m
                        {a.phone && <> · <Phone className="inline h-3 w-3" /> {a.phone}</>}
                        {a.email && <> · <Mail className="inline h-3 w-3" /> {a.email}</>}
                      </p>
                      {a.notes && (
                        <p className="mt-1 text-xs italic text-muted-foreground">{a.notes}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button
                      variant="subtle"
                      size="sm"
                      disabled={busyId === a.id || a.status === "NOTIFIED"}
                      onClick={() => notify(a.id)}
                    >
                      <BellRing className="h-3.5 w-3.5" /> Notifica
                    </Button>
                    <SeatPicker tables={tables} onSeat={(tid) => seat(a.id, tid)} disabled={busyId === a.id} />
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busyId === a.id}
                      onClick={() => patch(a.id, { status: "CANCELLED" })}
                    >
                      <XCircle className="h-3.5 w-3.5" /> Annulla
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busyId === a.id}
                      onClick={() => remove(a.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {closed.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Storico oggi</CardTitle>
            <CardDescription>{closed.length} iscritti chiusi</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 md:grid-cols-2">
            {closed.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-md border p-2 text-xs">
                <span>{c.guestName} · {c.partySize}p</span>
                <span className="flex items-center gap-2">
                  <Badge tone={c.status === "SEATED" ? "success" : "neutral"}>{c.status}</Badge>
                  <span className="text-muted-foreground">{formatTime(c.updatedAt)}</span>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SeatPicker({
  tables,
  onSeat,
  disabled,
}: {
  tables: TableOpt[];
  onSeat: (tableId: string | null) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="gold" size="sm" disabled={disabled} onClick={() => setOpen(true)}>
        <CheckCircle2 className="h-3.5 w-3.5" /> Accomoda
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assegna tavolo</DialogTitle>
            <DialogDescription>Crea una prenotazione walk-in arrivata.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              onSeat((fd.get("tableId") as string) || null);
              setOpen(false);
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label>Tavolo</Label>
              <Select name="tableId">
                <SelectTrigger>
                  <SelectValue placeholder="Da assegnare in seguito" />
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
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Annulla
              </Button>
              <Button type="submit" variant="gold">
                Conferma
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AddDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="gold">
          <Plus className="h-4 w-4" /> Aggiungi
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuovo iscritto</DialogTitle>
          <DialogDescription>Aggiungi un cliente in lista d&apos;attesa.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const fd = new FormData(e.currentTarget);
            await fetch("/api/waitlist", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                guestName: String(fd.get("guestName") ?? "").trim(),
                partySize: Number(fd.get("partySize") ?? 2),
                expectedWaitMin: Number(fd.get("expectedWaitMin") ?? 20),
                phone: String(fd.get("phone") ?? "").trim() || null,
                email: String(fd.get("email") ?? "").trim() || null,
                notes: String(fd.get("notes") ?? "").trim() || null,
              }),
            });
            setBusy(false);
            setOpen(false);
            router.refresh();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="wl-name">Nome</Label>
              <Input id="wl-name" name="guestName" required autoFocus maxLength={80} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wl-party">Persone</Label>
              <Input id="wl-party" name="partySize" type="number" min={1} max={20} defaultValue={2} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wl-wait">Attesa stimata (min)</Label>
              <Input id="wl-wait" name="expectedWaitMin" type="number" min={0} max={240} defaultValue={20} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wl-phone">Telefono</Label>
              <Input id="wl-phone" name="phone" placeholder="+39 …" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wl-email">Email</Label>
              <Input id="wl-email" name="email" type="email" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="wl-notes">Note</Label>
              <Textarea id="wl-notes" name="notes" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Annulla
            </Button>
            <Button type="submit" variant="gold" disabled={busy}>
              {busy ? "Aggiunta…" : "Aggiungi"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
