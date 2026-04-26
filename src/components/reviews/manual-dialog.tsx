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
import { Textarea } from "@/components/ui/textarea";

const SOURCES = [
  ["MANUAL", "Manuale"],
  ["GOOGLE", "Google"],
  ["TRIPADVISOR", "TripAdvisor"],
  ["FACEBOOK", "Facebook"],
  ["YELP", "Yelp"],
  ["TRUSTPILOT", "Trustpilot"],
] as const;

export function ManualReviewDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      source: fd.get("source"),
      rating: Number(fd.get("rating")),
      authorName: String(fd.get("authorName") ?? "").trim() || null,
      text: String(fd.get("text") ?? "").trim() || null,
      externalUrl: String(fd.get("externalUrl") ?? "").trim() || null,
      publishedAt: String(fd.get("publishedAt") ?? "") || null,
    };
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b?.error === "invalid_input" ? "Controlla i campi." : "Salvataggio non riuscito.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="h-4 w-4" /> Aggiungi recensione
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Recensione manuale</DialogTitle>
          <DialogDescription>
            Aggiungi una recensione ricevuta su un canale esterno. Per Google usa il pulsante
            &ldquo;Sincronizza Google&rdquo; in alto.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="rv-source">Sorgente</Label>
            <select
              id="rv-source"
              name="source"
              defaultValue="MANUAL"
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              {SOURCES.map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rv-rating">Stelle</Label>
            <Input
              id="rv-rating"
              name="rating"
              type="number"
              min={1}
              max={5}
              defaultValue={5}
              required
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="rv-author">Autore</Label>
            <Input id="rv-author" name="authorName" maxLength={120} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="rv-text">Testo</Label>
            <Textarea id="rv-text" name="text" rows={4} maxLength={2000} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rv-url">URL pubblica (opz.)</Label>
            <Input id="rv-url" name="externalUrl" type="url" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rv-date">Data pubblicazione</Label>
            <Input id="rv-date" name="publishedAt" type="date" />
          </div>
          {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
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
