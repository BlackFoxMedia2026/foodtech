"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Channel = "EMAIL" | "SMS" | "WHATSAPP";
type Category =
  | "GENERIC"
  | "WELCOME"
  | "REMINDER"
  | "THANK_YOU"
  | "PROMO"
  | "WIN_BACK"
  | "BIRTHDAY"
  | "ANNIVERSARY"
  | "EVENT";

type Tpl = {
  id: string;
  name: string;
  channel: Channel;
  subject: string | null;
  body: string;
  category: Category;
};

const CATEGORY_LABEL: Record<Category, string> = {
  GENERIC: "Generico",
  WELCOME: "Benvenuto",
  REMINDER: "Promemoria",
  THANK_YOU: "Grazie",
  PROMO: "Promo",
  WIN_BACK: "Recupero",
  BIRTHDAY: "Compleanno",
  ANNIVERSARY: "Anniversario",
  EVENT: "Evento",
};

export function TemplatesCard({ initial, canEdit }: { initial: Tpl[]; canEdit: boolean }) {
  const [list, setList] = useState<Tpl[]>(initial);
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Template messaggi</CardTitle>
            <CardDescription>
              Salva template riutilizzabili per email, SMS e WhatsApp. Usa{" "}
              <code className="rounded bg-secondary px-1">{"{{firstName}}"}</code> per personalizzare.
            </CardDescription>
          </div>
          {canEdit && <TemplateDialog onSaved={(t) => setList((l) => [...l.filter((x) => x.id !== t.id), t])} />}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {list.length === 0 ? (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nessun template salvato.
          </p>
        ) : (
          list.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{t.name}</span>
                  <Badge tone="neutral">{CATEGORY_LABEL[t.category]}</Badge>
                  <Badge tone="info">{t.channel}</Badge>
                </div>
                {t.subject && (
                  <p className="mt-1 truncate text-xs text-muted-foreground">{t.subject}</p>
                )}
              </div>
              {canEdit && (
                <div className="flex items-center gap-1">
                  <TemplateDialog
                    initial={t}
                    onSaved={(saved) =>
                      setList((l) => l.map((x) => (x.id === saved.id ? saved : x)))
                    }
                    onDeleted={(id) => setList((l) => l.filter((x) => x.id !== id))}
                  />
                </div>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function TemplateDialog({
  initial,
  onSaved,
  onDeleted,
}: {
  initial?: Tpl;
  onSaved: (t: Tpl) => void;
  onDeleted?: (id: string) => void;
}) {
  const router = useRouter();
  const editing = Boolean(initial?.id);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: String(fd.get("name") ?? "").trim(),
      channel: String(fd.get("channel") ?? "EMAIL") as Channel,
      category: String(fd.get("category") ?? "GENERIC") as Category,
      subject: String(fd.get("subject") ?? "").trim() || null,
      body: String(fd.get("body") ?? "").trim(),
    };
    const res = await fetch(editing ? `/api/templates/${initial!.id}` : "/api/templates", {
      method: editing ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (!res.ok) {
      setError("Salvataggio non riuscito.");
      return;
    }
    const saved = (await res.json()) as Tpl;
    onSaved(saved);
    setOpen(false);
    router.refresh();
  }

  async function onDelete() {
    if (!editing) return;
    if (!confirm(`Eliminare "${initial!.name}"?`)) return;
    setBusy(true);
    await fetch(`/api/templates/${initial!.id}`, { method: "DELETE" });
    setBusy(false);
    onDeleted?.(initial!.id);
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={editing ? "ghost" : "subtle"} size="sm">
          {editing ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {editing ? "Modifica" : "Nuovo template"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Modifica template" : "Nuovo template"}</DialogTitle>
          <DialogDescription>Riutilizzabile dal composer campagne.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="t-name">Nome</Label>
              <Input id="t-name" name="name" defaultValue={initial?.name ?? ""} required maxLength={80} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-cat">Categoria</Label>
              <select
                id="t-cat"
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
            <div className="space-y-1.5">
              <Label htmlFor="t-channel">Canale</Label>
              <select
                id="t-channel"
                name="channel"
                defaultValue={initial?.channel ?? "EMAIL"}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="EMAIL">Email</option>
                <option value="SMS">SMS</option>
                <option value="WHATSAPP">WhatsApp</option>
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="t-subj">Oggetto (solo email)</Label>
              <Input
                id="t-subj"
                name="subject"
                defaultValue={initial?.subject ?? ""}
                maxLength={120}
                placeholder="Hai dimenticato qualcosa, {{firstName}}?"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-3">
              <Label htmlFor="t-body">Corpo</Label>
              <MarkdownEditor
                id="t-body"
                name="body"
                rows={8}
                defaultValue={initial?.body ?? "Ciao {{firstName}},\n\n…"}
                hint="Markdown · usa {{firstName}}, {{venueName}}, {{date}}"
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
