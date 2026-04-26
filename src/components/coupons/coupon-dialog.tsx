"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
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

type Kind = "PERCENT" | "FIXED" | "FREE_ITEM" | "MENU_OFFER";
type Category =
  | "GENERIC"
  | "BIRTHDAY"
  | "WINBACK"
  | "EVENT"
  | "NEW_CUSTOMER"
  | "WIFI"
  | "REFERRAL"
  | "STAFF";
type Status = "ACTIVE" | "PAUSED" | "EXPIRED" | "ARCHIVED";

type Initial = {
  id?: string;
  code?: string;
  name?: string;
  description?: string | null;
  kind?: Kind;
  value?: number;
  freeItem?: string | null;
  category?: Category;
  status?: Status;
  validFrom?: string | null;
  validUntil?: string | null;
  maxRedemptions?: number | null;
  maxPerGuest?: number;
};

const CATEGORY_LABEL: Record<Category, string> = {
  GENERIC: "Generico",
  BIRTHDAY: "Compleanno",
  WINBACK: "Recupero clienti",
  EVENT: "Evento",
  NEW_CUSTOMER: "Nuovo cliente",
  WIFI: "Wi-Fi marketing",
  REFERRAL: "Referral",
  STAFF: "Staff",
};

function toLocal(d?: string | null) {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

export function CouponDialog({
  initial,
  currency,
}: {
  initial?: Initial;
  currency: string;
}) {
  const router = useRouter();
  const editing = Boolean(initial?.id);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind>(initial?.kind ?? "PERCENT");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const valueRaw = fd.get("value");
    let value = Number(valueRaw ?? 0);
    if (kind === "FIXED") value = Math.round(value * 100); // EUR → cents

    const validFromStr = String(fd.get("validFrom") ?? "");
    const validUntilStr = String(fd.get("validUntil") ?? "");

    const payload = {
      code: String(fd.get("code") ?? "").trim().toUpperCase() || undefined,
      name: String(fd.get("name") ?? "").trim(),
      description: String(fd.get("description") ?? "").trim() || null,
      kind,
      value,
      freeItem: kind === "FREE_ITEM" ? String(fd.get("freeItem") ?? "").trim() || null : null,
      category: fd.get("category") as Category,
      status: (fd.get("status") as Status) || undefined,
      validFrom: validFromStr ? new Date(validFromStr).toISOString() : null,
      validUntil: validUntilStr ? new Date(validUntilStr).toISOString() : null,
      maxRedemptions: fd.get("maxRedemptions") ? Number(fd.get("maxRedemptions")) : null,
      maxPerGuest: Number(fd.get("maxPerGuest") ?? 1),
    };

    const url = editing ? `/api/coupons/${initial!.id}` : "/api/coupons";
    const method = editing ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
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

  async function onDelete() {
    if (!editing) return;
    if (!confirm(`Eliminare il coupon "${initial!.name}"?`)) return;
    setBusy(true);
    await fetch(`/api/coupons/${initial!.id}`, { method: "DELETE" });
    setBusy(false);
    setOpen(false);
    router.refresh();
  }

  const valueLabel =
    kind === "PERCENT"
      ? "Sconto %"
      : kind === "FIXED"
        ? `Importo fisso (${currency})`
        : kind === "FREE_ITEM"
          ? "Valore stimato (interno)"
          : "Valore (cents, opzionale)";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={editing ? "ghost" : "gold"} size={editing ? "sm" : "default"}>
          {editing ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-4 w-4" />}
          {editing ? "" : "Nuovo coupon"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? `Modifica · ${initial!.name}` : "Nuovo coupon"}</DialogTitle>
          <DialogDescription>
            Codice, validità, segmento. Lo staff lo riscatta dal dettaglio prenotazione/ordine.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cp-name">Nome</Label>
              <Input id="cp-name" name="name" required defaultValue={initial?.name ?? ""} maxLength={80} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-code">Codice</Label>
              <Input
                id="cp-code"
                name="code"
                defaultValue={initial?.code ?? ""}
                placeholder={editing ? "" : "auto"}
                maxLength={40}
                style={{ textTransform: "uppercase" }}
                disabled={editing}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-kind">Tipo</Label>
              <select
                id="cp-kind"
                name="kind"
                value={kind}
                onChange={(e) => setKind(e.target.value as Kind)}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="PERCENT">Percentuale</option>
                <option value="FIXED">Importo fisso</option>
                <option value="FREE_ITEM">Omaggio</option>
                <option value="MENU_OFFER">Menu speciale</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-value">{valueLabel}</Label>
              <Input
                id="cp-value"
                name="value"
                type="number"
                min={0}
                step={kind === "FIXED" ? 0.5 : 1}
                defaultValue={
                  initial?.value !== undefined
                    ? kind === "FIXED"
                      ? initial.value / 100
                      : initial.value
                    : kind === "PERCENT"
                      ? 10
                      : 0
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-cat">Categoria</Label>
              <select
                id="cp-cat"
                name="category"
                defaultValue={initial?.category ?? "GENERIC"}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                {(Object.keys(CATEGORY_LABEL) as Category[]).map((k) => (
                  <option key={k} value={k}>
                    {CATEGORY_LABEL[k]}
                  </option>
                ))}
              </select>
            </div>

            {kind === "FREE_ITEM" && (
              <div className="space-y-1.5 sm:col-span-3">
                <Label htmlFor="cp-item">Cosa è in omaggio</Label>
                <Input
                  id="cp-item"
                  name="freeItem"
                  defaultValue={initial?.freeItem ?? ""}
                  placeholder="Calice di Franciacorta, Antipasto della casa…"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="cp-from">Valido da</Label>
              <Input
                id="cp-from"
                name="validFrom"
                type="date"
                defaultValue={toLocal(initial?.validFrom)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-until">Valido fino</Label>
              <Input
                id="cp-until"
                name="validUntil"
                type="date"
                defaultValue={toLocal(initial?.validUntil)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-max">Max riscatti</Label>
              <Input
                id="cp-max"
                name="maxRedemptions"
                type="number"
                min={1}
                defaultValue={initial?.maxRedemptions ?? ""}
                placeholder="∞"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-perg">Per cliente</Label>
              <Input
                id="cp-perg"
                name="maxPerGuest"
                type="number"
                min={1}
                defaultValue={initial?.maxPerGuest ?? 1}
              />
            </div>
            {editing && (
              <div className="space-y-1.5">
                <Label htmlFor="cp-st">Stato</Label>
                <select
                  id="cp-st"
                  name="status"
                  defaultValue={initial?.status ?? "ACTIVE"}
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="ACTIVE">Attivo</option>
                  <option value="PAUSED">In pausa</option>
                  <option value="EXPIRED">Scaduto</option>
                  <option value="ARCHIVED">Archiviato</option>
                </select>
              </div>
            )}

            <div className="space-y-1.5 sm:col-span-3">
              <Label htmlFor="cp-desc">Descrizione (opzionale)</Label>
              <Textarea
                id="cp-desc"
                name="description"
                rows={3}
                defaultValue={initial?.description ?? ""}
                maxLength={500}
              />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            {editing && (
              <Button type="button" variant="outline" onClick={onDelete} disabled={busy}>
                <Trash2 className="h-4 w-4" /> Elimina
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Annulla
            </Button>
            <Button type="submit" variant="gold" disabled={busy}>
              {busy ? "Salvataggio…" : editing ? "Salva" : "Crea"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
