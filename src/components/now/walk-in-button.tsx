"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Table = { id: string; label: string; seats: number };

export function WalkInButton({ tables }: { tables: Table[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const firstName = String(fd.get("firstName") ?? "").trim() || "Walk-in";
    const lastName = String(fd.get("lastName") ?? "").trim() || null;
    const partySize = Number(fd.get("partySize") ?? 2);
    const tableId = (fd.get("tableId") as string) || null;
    const durationMin = Number(fd.get("durationMin") ?? 90);

    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        guest: { firstName, lastName },
        partySize,
        tableId,
        startsAt: new Date().toISOString(),
        durationMin,
        source: "WALK_IN",
        status: "ARRIVED",
      }),
    });

    setSubmitting(false);
    if (!res.ok) {
      setError("Impossibile registrare il walk-in. Riprova.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="rounded-md border border-gilt/40 bg-gilt/10 px-3 py-2 text-xs text-gilt-light hover:bg-gilt/20 inline-flex items-center gap-2">
          <UserPlus className="h-3.5 w-3.5" /> Walk-in
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aggiungi walk-in</DialogTitle>
          <DialogDescription>
            Registra rapidamente ospiti arrivati senza prenotazione.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="walkin-firstName">Nome</Label>
              <Input id="walkin-firstName" name="firstName" autoFocus placeholder="Walk-in" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="walkin-lastName">Cognome (opzionale)</Label>
              <Input id="walkin-lastName" name="lastName" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="walkin-party">Persone</Label>
              <Input
                id="walkin-party"
                name="partySize"
                type="number"
                min={1}
                max={20}
                defaultValue={2}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="walkin-duration">Durata (min)</Label>
              <Input
                id="walkin-duration"
                name="durationMin"
                type="number"
                min={15}
                max={300}
                defaultValue={90}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Tavolo</Label>
            <Select name="tableId">
              <SelectTrigger>
                <SelectValue placeholder="Assegna in seguito" />
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

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border px-3 py-2 text-sm hover:bg-secondary"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-gilt px-4 py-2 text-sm font-medium text-carbon-900 hover:bg-gilt-light disabled:opacity-50"
            >
              {submitting ? "Registrazione…" : "Registra ed entra"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
