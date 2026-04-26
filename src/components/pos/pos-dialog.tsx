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

type Kind = "SQUARE" | "LIGHTSPEED" | "SUMUP" | "IZETTLE" | "TOAST" | "CUSTOM";
type Status = "DRAFT" | "ACTIVE" | "PAUSED" | "ERROR";

const KIND_LABEL: Record<Kind, string> = {
  SQUARE: "Square",
  LIGHTSPEED: "Lightspeed Restaurant",
  SUMUP: "SumUp",
  IZETTLE: "iZettle / Zettle",
  TOAST: "Toast",
  CUSTOM: "Webhook personalizzato",
};

type Initial = {
  id?: string;
  kind?: Kind;
  label?: string | null;
  externalRef?: string | null;
  status?: Status;
  webhookSecret?: string | null;
  webhookUrl?: string;
};

function genSecret() {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 32);
}

export function POSConnectorDialog({ initial }: { initial?: Initial }) {
  const router = useRouter();
  const editing = Boolean(initial?.id);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secret, setSecret] = useState(initial?.webhookSecret ?? "");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      kind: fd.get("kind") as Kind,
      label: String(fd.get("label") ?? "").trim() || null,
      externalRef: String(fd.get("externalRef") ?? "").trim() || null,
      status: (fd.get("status") as Status) || undefined,
      webhookSecret: secret || null,
    };
    const url = editing ? `/api/pos/${initial!.id}` : "/api/pos";
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
    if (!confirm(`Rimuovere il POS "${KIND_LABEL[initial!.kind!]}"?`)) return;
    setBusy(true);
    await fetch(`/api/pos/${initial!.id}`, { method: "DELETE" });
    setBusy(false);
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={editing ? "ghost" : "gold"} size={editing ? "sm" : "default"}>
          {editing ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-4 w-4" />}
          {editing ? "" : "Aggiungi POS"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {editing ? `POS · ${KIND_LABEL[initial!.kind!]}` : "Nuovo POS"}
          </DialogTitle>
          <DialogDescription>
            Configura il punto cassa. Le vendite arrivano via webhook e diventano Order interni
            con eventuale link alla prenotazione.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ps-kind">Provider</Label>
            <select
              id="ps-kind"
              name="kind"
              defaultValue={initial?.kind ?? "SQUARE"}
              disabled={editing}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ps-label">Etichetta</Label>
            <Input
              id="ps-label"
              name="label"
              defaultValue={initial?.label ?? ""}
              placeholder="Es. cassa principale"
              maxLength={80}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ps-extref">ID esterno / location</Label>
            <Input
              id="ps-extref"
              name="externalRef"
              defaultValue={initial?.externalRef ?? ""}
              placeholder="Es. SQ_LOC_ABC123"
              maxLength={120}
            />
          </div>
          {editing && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ps-status">Stato</Label>
              <select
                id="ps-status"
                name="status"
                defaultValue={initial?.status ?? "DRAFT"}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="DRAFT">Bozza</option>
                <option value="ACTIVE">Attivo</option>
                <option value="PAUSED">In pausa</option>
                <option value="ERROR">Errore</option>
              </select>
            </div>
          )}
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ps-secret">Webhook secret (HMAC SHA-256)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="ps-secret"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="Vuoto = nessuna verifica"
                maxLength={120}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => setSecret(genSecret())}>
                Genera
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Configura lo stesso secret nel pannello del POS. Il payload viene firmato con header{" "}
              <code>x-tavolo-signature</code>.
            </p>
          </div>
          {initial?.webhookUrl && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Webhook URL</Label>
              <pre className="overflow-x-auto rounded-md bg-secondary px-3 py-2 text-xs">
                {initial.webhookUrl}
              </pre>
            </div>
          )}
          {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
          <DialogFooter className="sm:col-span-2">
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
