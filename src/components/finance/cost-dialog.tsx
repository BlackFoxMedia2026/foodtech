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

const CATEGORIES = [
  ["FOOD", "Food cost"],
  ["BEVERAGE", "Bevande"],
  ["STAFF", "Personale"],
  ["RENT", "Affitto"],
  ["UTILITIES", "Utenze"],
  ["MARKETING", "Marketing"],
  ["SUPPLIES", "Forniture"],
  ["OTHER", "Altro"],
] as const;

export function CostDialog({ currency }: { currency: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const amount = Number(fd.get("amount") ?? 0);
    const payload = {
      category: fd.get("category"),
      label: String(fd.get("label") ?? "").trim(),
      amountCents: Math.round(amount * 100),
      occurredOn: String(fd.get("occurredOn") ?? new Date().toISOString().slice(0, 10)),
      recurring: fd.get("recurring") === "on",
    };
    const res = await fetch("/api/finance/costs", {
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
        <Button variant="gold">
          <Plus className="h-4 w-4" /> Nuovo costo
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuovo costo</DialogTitle>
          <DialogDescription>
            Registra spese ricorrenti o straordinarie. Andranno nel calcolo del margine 30 giorni.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="cost-label">Descrizione</Label>
            <Input id="cost-label" name="label" required maxLength={120} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cost-cat">Categoria</Label>
            <select
              id="cost-cat"
              name="category"
              defaultValue="FOOD"
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              {CATEGORIES.map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cost-amount">Importo ({currency})</Label>
            <Input
              id="cost-amount"
              name="amount"
              type="number"
              step="0.01"
              min={0}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cost-date">Data</Label>
            <Input
              id="cost-date"
              name="occurredOn"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="recurring" /> Ricorrente
          </label>
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
