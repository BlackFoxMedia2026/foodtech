"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Send, Trash2, Users2 } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";

type LoyaltyTier = "NEW" | "REGULAR" | "VIP" | "AMBASSADOR";
type Channel = "EMAIL" | "SMS" | "WHATSAPP";

type Initial = {
  id?: string;
  name?: string;
  channel?: Channel;
  subject?: string | null;
  body?: string | null;
  status?: "DRAFT" | "SCHEDULED" | "SENT" | "ARCHIVED";
  segment?: { marketingOptInOnly?: boolean; loyaltyTiers?: LoyaltyTier[]; tags?: string[] } | null;
};

const TIERS: LoyaltyTier[] = ["NEW", "REGULAR", "VIP", "AMBASSADOR"];

type TemplateOption = {
  id: string;
  name: string;
  channel: Channel;
  subject: string | null;
  body: string;
};

export function CampaignDialog({
  initial,
  emailEnabled,
  templates = [],
}: {
  initial?: Initial;
  emailEnabled: boolean;
  templates?: TemplateOption[];
}) {
  const router = useRouter();
  const editing = Boolean(initial?.id);
  const sent = initial?.status === "SENT";
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(initial?.name ?? "");
  const [channel, setChannel] = useState<Channel>(initial?.channel ?? "EMAIL");
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [body, setBody] = useState(initial?.body ?? "Ciao {{firstName}},\n\nSiamo felici di invitarti…");
  const [optInOnly, setOptInOnly] = useState(initial?.segment?.marketingOptInOnly ?? true);
  const [tiers, setTiers] = useState<LoyaltyTier[]>(initial?.segment?.loyaltyTiers ?? []);
  const [tagsRaw, setTagsRaw] = useState((initial?.segment?.tags ?? []).join(", "));
  const [previewTotal, setPreviewTotal] = useState<number | null>(null);

  const segment = {
    marketingOptInOnly: optInOnly,
    loyaltyTiers: tiers.length ? tiers : undefined,
    tags: tagsRaw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
  };

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/campaigns/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(segment),
    })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setPreviewTotal(d.total ?? 0);
      })
      .catch(() => !cancelled && setPreviewTotal(null));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, optInOnly, tiers.join(","), tagsRaw]);

  function toggleTier(t: LoyaltyTier) {
    setTiers((curr) => (curr.includes(t) ? curr.filter((x) => x !== t) : [...curr, t]));
  }

  async function save(action: "save" | "send") {
    setError(null);
    setSubmitting(true);
    const payload = {
      name: name.trim(),
      channel,
      subject: subject.trim() || null,
      body: body.trim(),
      segment,
    };

    const url = editing ? `/api/campaigns/${initial!.id}` : "/api/campaigns";
    const method = editing ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      setSubmitting(false);
      const b = await res.json().catch(() => ({}));
      setError(b?.error === "invalid_input" ? "Controlla i campi." : "Salvataggio non riuscito.");
      return;
    }
    const saved = await res.json();
    setSubmitting(false);

    if (action === "save") {
      setOpen(false);
      router.refresh();
      return;
    }

    if (channel !== "EMAIL") {
      setError("Solo le campagne EMAIL possono essere inviate.");
      return;
    }

    setSending(true);
    const sendRes = await fetch(`/api/campaigns/${saved.id}/send`, { method: "POST" });
    setSending(false);
    if (!sendRes.ok) {
      const b = await sendRes.json().catch(() => ({}));
      setError(`Invio non riuscito: ${b?.error ?? "errore"}`);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  async function onDelete() {
    if (!editing) return;
    if (!confirm(`Eliminare la campagna "${initial!.name}"?`)) return;
    setSubmitting(true);
    await fetch(`/api/campaigns/${initial!.id}`, { method: "DELETE" });
    setSubmitting(false);
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={editing ? "ghost" : "gold"} size={editing ? "sm" : "default"}>
          {editing ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {editing ? "Apri" : "Nuova campagna"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {editing ? `${initial!.name}` : "Nuova campagna"}
            {sent && <Badge tone="success" className="ml-2">Inviata</Badge>}
          </DialogTitle>
          <DialogDescription>
            Componi un&apos;email, scegli il segmento di ospiti e invia. Usa{" "}
            <code className="rounded bg-secondary px-1">{"{{firstName}}"}</code> per personalizzare.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="cmp-name">Nome interno</Label>
            <Input
              id="cmp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={80}
              disabled={sent}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Canale</Label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as Channel)}
              disabled={sent}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="EMAIL">Email</option>
              <option value="SMS">SMS (presto)</option>
              <option value="WHATSAPP">WhatsApp (presto)</option>
            </select>
          </div>
          {templates.length > 0 && !sent && (
            <div className="space-y-1.5 sm:col-span-3">
              <Label htmlFor="cmp-tpl">Template (opzionale)</Label>
              <select
                id="cmp-tpl"
                onChange={(e) => {
                  const tpl = templates.find((t) => t.id === e.target.value);
                  if (!tpl) return;
                  setSubject(tpl.subject ?? "");
                  setBody(tpl.body);
                  setChannel(tpl.channel);
                }}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                defaultValue=""
              >
                <option value="">— inserisci da template —</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} · {t.channel}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-1.5 sm:col-span-3">
            <Label htmlFor="cmp-subject">Oggetto</Label>
            <Input
              id="cmp-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={120}
              disabled={sent}
              placeholder={`Una sera diversa al locale, ${"{{firstName}}"}…`}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-3">
            <Label htmlFor="cmp-body">Corpo</Label>
            <Textarea
              id="cmp-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              required
              disabled={sent}
            />
          </div>
        </div>

        <div className="rounded-md border bg-secondary/40 p-3 text-sm">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Segmento ospiti
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={optInOnly}
                onChange={(e) => setOptInOnly(e.target.checked)}
                disabled={sent}
                className="h-4 w-4"
              />
              Solo opt-in marketing
            </label>
            <div className="sm:col-span-2 flex flex-wrap items-center gap-1.5">
              {TIERS.map((t) => (
                <button
                  type="button"
                  key={t}
                  disabled={sent}
                  onClick={() => toggleTier(t)}
                  className={`rounded-full border px-2.5 py-0.5 text-xs ${
                    tiers.includes(t)
                      ? "border-gilt bg-gilt/10 text-gilt-dark"
                      : "border-border text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="space-y-1.5 sm:col-span-3">
              <Label htmlFor="cmp-tags">Tag (separati da virgola)</Label>
              <Input
                id="cmp-tags"
                value={tagsRaw}
                onChange={(e) => setTagsRaw(e.target.value)}
                disabled={sent}
                placeholder="fedele, weekend, lunch-club"
              />
            </div>
            <p className="sm:col-span-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users2 className="h-3.5 w-3.5" />
              {previewTotal === null
                ? "Calcolo destinatari…"
                : `${previewTotal} destinatari corrispondenti`}
            </p>
          </div>
        </div>

        {!emailEnabled && (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <strong>RESEND_API_KEY mancante:</strong> l&apos;invio funziona ma le email non vengono
            recapitate (saranno loggate come no-op).
          </p>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          {editing && !sent && (
            <Button type="button" variant="outline" onClick={onDelete} disabled={submitting}>
              <Trash2 className="h-4 w-4" /> Elimina
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Chiudi
          </Button>
          {!sent && (
            <>
              <Button type="button" variant="subtle" onClick={() => save("save")} disabled={submitting || !name.trim() || !body.trim()}>
                {submitting ? "Salvataggio…" : "Salva bozza"}
              </Button>
              <Button
                type="button"
                variant="gold"
                onClick={() => save("send")}
                disabled={submitting || sending || !name.trim() || !body.trim() || channel !== "EMAIL"}
              >
                <Send className="h-4 w-4" />
                {sending ? "Invio…" : `Invia${previewTotal != null ? ` a ${previewTotal}` : ""}`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
