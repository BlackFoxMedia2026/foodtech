"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Pencil, Plus, Trash2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";

export type VenueRow = {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  kind: "RESTAURANT" | "BEACH_CLUB" | "BAR" | "HOTEL_RESTAURANT" | "PRIVATE_CLUB";
  active: boolean;
};

const KIND_LABELS: Record<VenueRow["kind"], string> = {
  RESTAURANT: "Ristorante",
  BEACH_CLUB: "Beach Club",
  BAR: "Bar",
  HOTEL_RESTAURANT: "Ristorante d'hotel",
  PRIVATE_CLUB: "Club privato",
};

type FormState = {
  name: string;
  kind: VenueRow["kind"];
  city: string;
  address: string;
  country: string;
  phone: string;
  email: string;
  active: boolean;
};

const EMPTY_FORM: FormState = {
  name: "",
  kind: "RESTAURANT",
  city: "",
  address: "",
  country: "",
  phone: "",
  email: "",
  active: true,
};

export function VenuesCard({
  initial,
  activeVenueId,
  canEdit,
  orgName,
  plan,
}: {
  initial: VenueRow[];
  activeVenueId: string;
  canEdit: boolean;
  orgName: string;
  plan: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [list, setList] = useState<VenueRow[]>(initial);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<VenueRow | null>(null);
  const [deleting, setDeleting] = useState<VenueRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formInitial = useMemo<FormState>(() => {
    if (!editing) return EMPTY_FORM;
    return {
      name: editing.name,
      kind: editing.kind,
      city: editing.city ?? "",
      address: editing.address ?? "",
      country: editing.country ?? "",
      phone: editing.phone ?? "",
      email: editing.email ?? "",
      active: editing.active,
    };
  }, [editing]);

  const dialogOpen = creating || editing !== null;

  function closeDialog() {
    setCreating(false);
    setEditing(null);
    setError(null);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: String(fd.get("name") ?? "").trim(),
      kind: fd.get("kind") as VenueRow["kind"],
      city: String(fd.get("city") ?? "").trim() || null,
      address: String(fd.get("address") ?? "").trim() || null,
      country: String(fd.get("country") ?? "").trim() || null,
      phone: String(fd.get("phone") ?? "").trim() || null,
      email: String(fd.get("email") ?? "").trim() || null,
      active: fd.get("active") === "on",
    };

    const url = editing ? `/api/venues/${editing.id}` : "/api/venues";
    const method = editing ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      if (body?.error === "plan_limit_reached") {
        toast.error("Plan limit reached", body.message);
        setError(body.message ?? "Plan limit reached.");
        return;
      }
      setError("Impossibile salvare. Verifica i dati.");
      return;
    }
    const saved = (await res.json()) as VenueRow;
    setList((l) => {
      if (editing) return l.map((v) => (v.id === saved.id ? { ...v, ...saved } : v));
      return [...l, saved].sort((a, b) => a.name.localeCompare(b.name));
    });
    closeDialog();
    router.refresh();
  }

  async function onDelete() {
    if (!deleting) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/venues/${deleting.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(
        body?.error === "last_venue"
          ? "Non puoi eliminare l'ultimo locale del gruppo."
          : "Eliminazione non riuscita.",
      );
      return;
    }
    setList((l) => l.filter((v) => v.id !== deleting.id));
    setDeleting(null);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Locali del gruppo</CardTitle>
            <CardDescription>
              {orgName} · piano {plan}
              {!canEdit && " · solo il Manager può modificarli"}
            </CardDescription>
          </div>
          {canEdit && (
            <Button variant="subtle" size="sm" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> Aggiungi locale
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {list.map((v) => (
          <div
            key={v.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="grid h-8 w-8 place-items-center rounded-md bg-secondary text-muted-foreground">
                <Building2 className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium">{v.name}</p>
                <p className="text-xs text-muted-foreground">
                  {[v.city, KIND_LABELS[v.kind]].filter(Boolean).join(" · ")}
                  {!v.active && " · disattivo"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {v.id === activeVenueId && <Badge tone="gold">Attivo</Badge>}
              {canEdit && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditing(v)}
                    aria-label={`Modifica ${v.name}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setError(null);
                      setDeleting(v);
                    }}
                    disabled={list.length <= 1}
                    aria-label={`Elimina ${v.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifica locale" : "Nuovo locale"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Aggiorna le informazioni del locale."
                : "Aggiungi un nuovo locale al gruppo. Diventerai automaticamente Manager del nuovo locale."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="venue-name">Nome</Label>
                <Input
                  id="venue-name"
                  name="name"
                  required
                  defaultValue={formInitial.name}
                  placeholder="Aurora Bistrot"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tipologia</Label>
                <Select name="kind" defaultValue={formInitial.kind}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(KIND_LABELS) as VenueRow["kind"][]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {KIND_LABELS[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="venue-city">Città</Label>
                <Input
                  id="venue-city"
                  name="city"
                  defaultValue={formInitial.city}
                  placeholder="Milano"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="venue-address">Indirizzo</Label>
                <Input
                  id="venue-address"
                  name="address"
                  defaultValue={formInitial.address}
                  placeholder="Via Montenapoleone 12"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="venue-country">Paese</Label>
                <Input
                  id="venue-country"
                  name="country"
                  defaultValue={formInitial.country}
                  placeholder="IT"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="venue-phone">Telefono</Label>
                <Input
                  id="venue-phone"
                  name="phone"
                  defaultValue={formInitial.phone}
                  placeholder="+39 …"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="venue-email">Email</Label>
                <Input
                  id="venue-email"
                  name="email"
                  type="email"
                  defaultValue={formInitial.email}
                  placeholder="info@auroramilano.it"
                />
              </div>
              <div className="flex items-center gap-2 sm:col-span-2">
                <input
                  id="venue-active"
                  name="active"
                  type="checkbox"
                  defaultChecked={formInitial.active}
                  className="h-4 w-4 rounded border-input"
                />
                <Label htmlFor="venue-active" className="text-sm font-normal">
                  Locale attivo
                </Label>
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={closeDialog} disabled={busy}>
                Annulla
              </Button>
              <Button type="submit" variant="gold" disabled={busy}>
                {busy
                  ? "Salvataggio…"
                  : editing
                    ? "Salva modifiche"
                    : "Crea locale"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminare “{deleting?.name}”?</DialogTitle>
            <DialogDescription>
              L&apos;operazione rimuove il locale e tutti i dati collegati (tavoli, prenotazioni,
              ospiti, pagamenti). Non è reversibile.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeleting(null)}
              disabled={busy}
            >
              Annulla
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={onDelete}
              disabled={busy}
            >
              {busy ? "Eliminazione…" : "Elimina locale"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
