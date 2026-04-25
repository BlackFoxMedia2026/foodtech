"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil } from "lucide-react";
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
import { Button } from "@/components/ui/button";

type Initial = {
  id?: string;
  title?: string;
  slug?: string;
  description?: string | null;
  startsAt?: string;
  endsAt?: string;
  capacity?: number;
  priceCents?: number;
  ticketUrl?: string | null;
  coverImage?: string | null;
  published?: boolean;
};

function toLocal(d?: string) {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

export function ExperienceDialog({
  initial,
  triggerLabel,
  triggerIcon,
  triggerVariant = "gold",
  triggerSize = "default",
}: {
  initial?: Initial;
  triggerLabel?: string;
  triggerIcon?: "plus" | "edit";
  triggerVariant?: "gold" | "subtle" | "outline" | "ghost";
  triggerSize?: "default" | "sm";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const editing = Boolean(initial?.id);
  const Icon = triggerIcon === "edit" ? Pencil : Plus;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const priceEur = Number(fd.get("priceEur") ?? 0);

    const payload = {
      title: String(fd.get("title") ?? "").trim(),
      slug: String(fd.get("slug") ?? "").trim() || undefined,
      description: String(fd.get("description") ?? "").trim() || null,
      startsAt: new Date(String(fd.get("startsAt"))).toISOString(),
      endsAt: new Date(String(fd.get("endsAt"))).toISOString(),
      capacity: Number(fd.get("capacity") ?? 40),
      priceCents: Math.max(0, Math.round(priceEur * 100)),
      ticketUrl: String(fd.get("ticketUrl") ?? "").trim() || null,
      coverImage: String(fd.get("coverImage") ?? "").trim() || null,
      published: fd.get("published") === "on",
    };

    const url = editing ? `/api/experiences/${initial!.id}` : "/api/experiences";
    const method = editing ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      body: JSON.stringify(payload),
      headers: { "content-type": "application/json" },
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(
        body?.error === "invalid_dates"
          ? "La fine deve essere dopo l'inizio."
          : body?.error === "invalid_input"
            ? "Controlla i campi obbligatori."
            : "Salvataggio non riuscito.",
      );
      return;
    }
    setOpen(false);
    startTransition(() => router.refresh());
  }

  async function onDelete() {
    if (!editing) return;
    if (!confirm(`Eliminare "${initial!.title}"?`)) return;
    setSubmitting(true);
    const res = await fetch(`/api/experiences/${initial!.id}`, { method: "DELETE" });
    setSubmitting(false);
    if (res.ok) {
      setOpen(false);
      startTransition(() => router.refresh());
    }
  }

  const defaultStart = toLocal(initial?.startsAt) || toLocal(new Date(Date.now() + 86_400_000).toISOString());
  const defaultEnd = toLocal(initial?.endsAt) || toLocal(new Date(Date.now() + 86_400_000 + 3 * 3600_000).toISOString());

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size={triggerSize}>
          <Icon className="h-4 w-4" /> {triggerLabel ?? (editing ? "Modifica" : "Nuova esperienza")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Modifica esperienza" : "Nuova esperienza"}</DialogTitle>
          <DialogDescription>
            Definisci titolo, capienza, prezzo e finestra. Pubblica quando vuoi che sia visibile sul widget.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="exp-title">Titolo</Label>
              <Input id="exp-title" name="title" defaultValue={initial?.title ?? ""} required maxLength={120} placeholder="Cena tartufo, Saturday Sunset, …" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exp-slug">Slug (URL)</Label>
              <Input id="exp-slug" name="slug" defaultValue={initial?.slug ?? ""} placeholder="cena-tartufo" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exp-cap">Capienza</Label>
              <Input id="exp-cap" name="capacity" type="number" min={1} max={2000} defaultValue={initial?.capacity ?? 40} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exp-start">Inizio</Label>
              <Input id="exp-start" name="startsAt" type="datetime-local" defaultValue={defaultStart} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exp-end">Fine</Label>
              <Input id="exp-end" name="endsAt" type="datetime-local" defaultValue={defaultEnd} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exp-price">Prezzo (€) — 0 = gratis</Label>
              <Input id="exp-price" name="priceEur" type="number" min={0} step={0.5} defaultValue={(initial?.priceCents ?? 0) / 100} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exp-cover">Cover image (URL)</Label>
              <Input id="exp-cover" name="coverImage" type="url" defaultValue={initial?.coverImage ?? ""} placeholder="https://…" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="exp-desc">Descrizione</Label>
              <Textarea id="exp-desc" name="description" rows={3} defaultValue={initial?.description ?? ""} />
            </div>
            <label className="inline-flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" name="published" defaultChecked={initial?.published ?? false} className="h-4 w-4" />
              Pubblicata (visibile nel widget)
            </label>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            {editing ? (
              <Button type="button" variant="outline" onClick={onDelete} disabled={submitting}>
                Elimina
              </Button>
            ) : null}
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Annulla
            </Button>
            <Button type="submit" variant="gold" disabled={submitting}>
              {submitting ? "Salvataggio…" : editing ? "Salva" : "Crea"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
