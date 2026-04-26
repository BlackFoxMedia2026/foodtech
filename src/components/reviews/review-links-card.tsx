"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Plus, Trash2, Pencil } from "lucide-react";
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
  DialogTrigger,
} from "@/components/ui/dialog";

type Platform =
  | "GOOGLE"
  | "TRIPADVISOR"
  | "TRUSTPILOT"
  | "THEFORK"
  | "FACEBOOK"
  | "INSTAGRAM"
  | "YELP"
  | "OTHER";

const LABEL: Record<Platform, string> = {
  GOOGLE: "Google",
  TRIPADVISOR: "TripAdvisor",
  TRUSTPILOT: "Trustpilot",
  THEFORK: "TheFork",
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  YELP: "Yelp",
  OTHER: "Altro",
};

type Link = {
  id: string;
  platform: Platform;
  label: string | null;
  url: string;
  ordering: number;
  active: boolean;
  clicks?: number;
};

export function ReviewLinksCard({
  initial,
  canEdit,
}: {
  initial: Link[];
  canEdit: boolean;
}) {
  const [list, setList] = useState<Link[]>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const router = useRouter();

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(id);
    const res = await fetch(`/api/review-links/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(null);
    if (res.ok) {
      setList((l) => l.map((x) => (x.id === id ? { ...x, ...body } : x)));
      router.refresh();
    }
  }

  async function remove(id: string) {
    if (!confirm("Eliminare il link?")) return;
    setBusy(id);
    await fetch(`/api/review-links/${id}`, { method: "DELETE" });
    setBusy(null);
    setList((l) => l.filter((x) => x.id !== id));
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Funnel recensioni esterne</CardTitle>
            <CardDescription>
              Gli ospiti che danno NPS ≥ 9 vedono questi link nella thank-you page del sondaggio. I
              click vengono tracciati.
            </CardDescription>
          </div>
          {canEdit && <NewDialog onCreated={(l) => setList((arr) => [...arr, l])} />}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {list.length === 0 ? (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nessun link configurato. Aggiungi Google/TripAdvisor per indirizzare i promoter.
          </p>
        ) : (
          list.map((l) => (
            <div
              key={l.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-medium">
                  {LABEL[l.platform]}
                  {!l.active && <Badge tone="warning">disattivato</Badge>}
                </p>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-xs text-muted-foreground hover:underline"
                >
                  {l.url}
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone="neutral">{l.clicks ?? 0} click</Badge>
                {canEdit && (
                  <>
                    <EditDialog initial={l} onSaved={(u) => patch(u.id, u)} />
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy === l.id}
                      onClick={() => patch(l.id, { active: !l.active })}
                    >
                      {l.active ? "Disattiva" : "Attiva"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy === l.id}
                      onClick={() => remove(l.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
                <a
                  href={l.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  Apri <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function NewDialog({ onCreated }: { onCreated: (l: Link) => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="subtle" size="sm">
          <Plus className="h-4 w-4" /> Aggiungi link
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuovo link recensione</DialogTitle>
          <DialogDescription>Verrà mostrato ai promoter alla fine del sondaggio.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            const fd = new FormData(e.currentTarget);
            const res = await fetch("/api/review-links", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                platform: fd.get("platform"),
                url: String(fd.get("url") ?? "").trim(),
                label: String(fd.get("label") ?? "").trim() || null,
              }),
            });
            setBusy(false);
            if (!res.ok) {
              setError("Salvataggio non riuscito.");
              return;
            }
            const created = await res.json();
            onCreated({ ...created, clicks: 0 });
            setOpen(false);
            router.refresh();
          }}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="rl-platform">Piattaforma</Label>
            <select
              id="rl-platform"
              name="platform"
              defaultValue="GOOGLE"
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              {(Object.keys(LABEL) as Platform[]).map((p) => (
                <option key={p} value={p}>
                  {LABEL[p]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rl-url">URL</Label>
            <Input id="rl-url" name="url" type="url" required placeholder="https://g.page/…" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rl-label">Etichetta (opzionale)</Label>
            <Input id="rl-label" name="label" maxLength={60} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Annulla
            </Button>
            <Button type="submit" variant="gold" disabled={busy}>
              {busy ? "Salvataggio…" : "Crea"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({
  initial,
  onSaved,
}: {
  initial: Link;
  onSaved: (l: Link) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifica link</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const fd = new FormData(e.currentTarget);
            const body = {
              platform: fd.get("platform") as Platform,
              url: String(fd.get("url") ?? "").trim(),
              label: String(fd.get("label") ?? "").trim() || null,
              ordering: Number(fd.get("ordering") ?? 0),
            };
            const res = await fetch(`/api/review-links/${initial.id}`, {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(body),
            });
            setBusy(false);
            if (res.ok) {
              onSaved({ ...initial, ...body });
              setOpen(false);
            }
          }}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="rl-e-platform">Piattaforma</Label>
            <select
              id="rl-e-platform"
              name="platform"
              defaultValue={initial.platform}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              {(Object.keys(LABEL) as Platform[]).map((p) => (
                <option key={p} value={p}>
                  {LABEL[p]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rl-e-url">URL</Label>
            <Input id="rl-e-url" name="url" type="url" required defaultValue={initial.url} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rl-e-label">Etichetta</Label>
              <Input id="rl-e-label" name="label" defaultValue={initial.label ?? ""} maxLength={60} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rl-e-ord">Ordine</Label>
              <Input id="rl-e-ord" name="ordering" type="number" min={0} defaultValue={initial.ordering} />
            </div>
          </div>
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
