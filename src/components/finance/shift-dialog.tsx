"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ShiftDialog({ currency }: { currency: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const hourly = Number(fd.get("hourly") ?? 0);
    const payload = {
      staffName: String(fd.get("staffName") ?? "").trim(),
      role: String(fd.get("role") ?? "").trim() || null,
      date: String(fd.get("date") ?? new Date().toISOString().slice(0, 10)),
      hours: Number(fd.get("hours") ?? 0),
      hourlyCents: Math.round(hourly * 100),
      notes: String(fd.get("notes") ?? "").trim() || null,
    };
    const res = await fetch("/api/finance/shifts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (res.ok) {
      setOpen(false);
      router.refresh();
    } else {
      alert("Salvataggio non riuscito.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-3.5 w-3.5" /> Aggiungi turno
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuovo turno</DialogTitle>
          <DialogDescription>
            Registra ore + tariffa oraria. Concorre al calcolo del costo del personale.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="sh-name">Nome</Label>
            <Input id="sh-name" name="staffName" required maxLength={80} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sh-role">Ruolo (opzionale)</Label>
            <Input id="sh-role" name="role" placeholder="Sala, cucina…" maxLength={40} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sh-date">Data</Label>
            <Input
              id="sh-date"
              name="date"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sh-hours">Ore</Label>
            <Input id="sh-hours" name="hours" type="number" step="0.25" min={0} defaultValue={8} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sh-hourly">Tariffa oraria ({currency})</Label>
            <Input
              id="sh-hourly"
              name="hourly"
              type="number"
              step="0.5"
              min={0}
              defaultValue={12}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="sh-notes">Note</Label>
            <Input id="sh-notes" name="notes" maxLength={400} />
          </div>
          <DialogFooter className="sm:col-span-2">
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
