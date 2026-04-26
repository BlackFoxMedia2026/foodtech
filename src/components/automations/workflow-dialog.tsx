"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2, X } from "lucide-react";
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

type Trigger =
  | "BOOKING_CREATED"
  | "BOOKING_COMPLETED"
  | "GUEST_BIRTHDAY"
  | "GUEST_INACTIVE"
  | "COUPON_NOT_USED"
  | "NPS_DETRACTOR"
  | "WIFI_LEAD_CREATED"
  | "ORDER_COMPLETED"
  | "CUSTOM";

type ActionKind =
  | "SEND_EMAIL"
  | "SEND_SMS"
  | "SEND_WHATSAPP"
  | "CREATE_COUPON"
  | "ADD_GUEST_TAG"
  | "CREATE_STAFF_TASK";

type ActionParams = {
  subject?: string;
  body?: string;
  couponName?: string;
  couponKind?: "PERCENT" | "FIXED" | "FREE_ITEM";
  couponValue?: number;
  couponDays?: number;
  couponCategory?: string;
  tag?: string;
  title?: string;
  details?: string;
};

type ActionItem = { kind: ActionKind; params: ActionParams };

type Initial = {
  id?: string;
  name?: string;
  description?: string | null;
  trigger?: Trigger;
  active?: boolean;
  delayMinutes?: number;
  conditions?: {
    loyaltyTiers?: string[];
    minVisits?: number;
    inactiveDays?: number;
    couponDaysSinceCreated?: number;
    minPartySize?: number;
    requireConsent?: boolean;
  } | null;
  actions?: ActionItem[];
};

const TRIGGER_LABEL: Record<Trigger, string> = {
  BOOKING_CREATED: "Prenotazione creata",
  BOOKING_COMPLETED: "Prenotazione completata",
  GUEST_BIRTHDAY: "Compleanno ospite",
  GUEST_INACTIVE: "Ospite inattivo",
  COUPON_NOT_USED: "Coupon non utilizzato",
  NPS_DETRACTOR: "NPS detrattore",
  WIFI_LEAD_CREATED: "Nuovo lead Wi-Fi",
  ORDER_COMPLETED: "Ordine completato",
  CUSTOM: "Evento personalizzato",
};

const ACTION_LABEL: Record<ActionKind, string> = {
  SEND_EMAIL: "Invia email",
  SEND_SMS: "Invia SMS",
  SEND_WHATSAPP: "Invia WhatsApp",
  CREATE_COUPON: "Crea coupon dedicato",
  ADD_GUEST_TAG: "Aggiungi tag ospite",
  CREATE_STAFF_TASK: "Crea task per lo staff",
};

export function WorkflowDialog({ initial }: { initial?: Initial }) {
  const router = useRouter();
  const editing = Boolean(initial?.id);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState<Trigger>(initial?.trigger ?? "BOOKING_COMPLETED");
  const [actions, setActions] = useState<ActionItem[]>(
    initial?.actions && initial.actions.length > 0
      ? initial.actions
      : [{ kind: "SEND_EMAIL", params: { subject: "", body: "" } }],
  );

  function patchAction(i: number, patch: Partial<ActionItem>) {
    setActions((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], ...patch, params: { ...next[i].params, ...(patch.params ?? {}) } };
      return next;
    });
  }

  function patchActionParams(i: number, patch: ActionParams) {
    setActions((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], params: { ...next[i].params, ...patch } };
      return next;
    });
  }

  function addAction() {
    if (actions.length >= 5) return;
    setActions((prev) => [...prev, { kind: "ADD_GUEST_TAG", params: {} }]);
  }

  function removeAction(i: number) {
    setActions((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);

    const minVisits = fd.get("minVisits");
    const inactiveDays = fd.get("inactiveDays");
    const couponDaysSinceCreated = fd.get("couponDaysSinceCreated");
    const minPartySize = fd.get("minPartySize");
    const conditions = {
      loyaltyTiers: fd.getAll("loyaltyTiers").map(String).filter(Boolean),
      minVisits: minVisits ? Number(minVisits) : undefined,
      inactiveDays: inactiveDays ? Number(inactiveDays) : undefined,
      couponDaysSinceCreated: couponDaysSinceCreated ? Number(couponDaysSinceCreated) : undefined,
      minPartySize: minPartySize ? Number(minPartySize) : undefined,
      requireConsent: fd.get("requireConsent") === "on",
    };

    const payload = {
      name: String(fd.get("name") ?? "").trim(),
      description: String(fd.get("description") ?? "").trim() || null,
      trigger,
      delayMinutes: Number(fd.get("delayMinutes") ?? 0),
      active: fd.get("active") === "on",
      conditions,
      actions,
    };

    const url = editing ? `/api/automations/${initial!.id}` : "/api/automations";
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
    if (!confirm(`Eliminare l'automazione "${initial!.name}"?`)) return;
    setBusy(true);
    await fetch(`/api/automations/${initial!.id}`, { method: "DELETE" });
    setBusy(false);
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={editing ? "ghost" : "gold"} size={editing ? "sm" : "default"}>
          {editing ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-4 w-4" />}
          {editing ? "" : "Nuova automazione"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? `Modifica · ${initial!.name}` : "Nuova automazione"}</DialogTitle>
          <DialogDescription>
            Scegli quando far partire il flusso e cosa eseguire. Massimo 5 azioni a catena.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="wf-name">Nome</Label>
              <Input
                id="wf-name"
                name="name"
                required
                defaultValue={initial?.name ?? ""}
                maxLength={80}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wf-delay">Ritardo (min)</Label>
              <Input
                id="wf-delay"
                name="delayMinutes"
                type="number"
                min={0}
                defaultValue={initial?.delayMinutes ?? 0}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-3">
              <Label htmlFor="wf-desc">Note interne (opzionale)</Label>
              <Textarea
                id="wf-desc"
                name="description"
                rows={2}
                defaultValue={initial?.description ?? ""}
                maxLength={500}
              />
            </div>
          </div>

          <div className="rounded-md border p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Quando</p>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  name="active"
                  defaultChecked={initial?.active ?? false}
                />
                Attiva
              </label>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <select
                value={trigger}
                onChange={(e) => setTrigger(e.target.value as Trigger)}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                {(Object.keys(TRIGGER_LABEL) as Trigger[]).map((t) => (
                  <option key={t} value={t}>
                    {TRIGGER_LABEL[t]}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  name="requireConsent"
                  defaultChecked={initial?.conditions?.requireConsent ?? true}
                />
                Richiedi consenso prima di inviare messaggi
              </label>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="space-y-1">
                <Label className="text-xs">Tier loyalty</Label>
                <select
                  name="loyaltyTiers"
                  multiple
                  defaultValue={initial?.conditions?.loyaltyTiers ?? []}
                  className="min-h-[80px] w-full rounded-md border bg-background px-2 py-1 text-xs"
                >
                  <option value="NEW">Nuovo</option>
                  <option value="REGULAR">Regolare</option>
                  <option value="VIP">VIP</option>
                  <option value="AMBASSADOR">Ambassador</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="wf-minVisits">
                  Min. visite
                </Label>
                <Input
                  id="wf-minVisits"
                  name="minVisits"
                  type="number"
                  min={0}
                  defaultValue={initial?.conditions?.minVisits ?? ""}
                />
              </div>
              {trigger === "GUEST_INACTIVE" && (
                <div className="space-y-1">
                  <Label className="text-xs" htmlFor="wf-inactive">
                    Giorni inattivo
                  </Label>
                  <Input
                    id="wf-inactive"
                    name="inactiveDays"
                    type="number"
                    min={1}
                    defaultValue={initial?.conditions?.inactiveDays ?? 90}
                  />
                </div>
              )}
              {trigger === "COUPON_NOT_USED" && (
                <div className="space-y-1">
                  <Label className="text-xs" htmlFor="wf-couponDays">
                    Giorni dal rilascio
                  </Label>
                  <Input
                    id="wf-couponDays"
                    name="couponDaysSinceCreated"
                    type="number"
                    min={1}
                    defaultValue={initial?.conditions?.couponDaysSinceCreated ?? 14}
                  />
                </div>
              )}
              {(trigger === "BOOKING_CREATED" || trigger === "BOOKING_COMPLETED") && (
                <div className="space-y-1">
                  <Label className="text-xs" htmlFor="wf-party">
                    Coperti min.
                  </Label>
                  <Input
                    id="wf-party"
                    name="minPartySize"
                    type="number"
                    min={1}
                    defaultValue={initial?.conditions?.minPartySize ?? ""}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Cosa eseguire</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addAction}
                disabled={actions.length >= 5}
              >
                <Plus className="h-3.5 w-3.5" /> Aggiungi azione
              </Button>
            </div>
            {actions.map((a, i) => (
              <div key={i} className="rounded-md border p-3">
                <div className="flex items-start gap-2">
                  <select
                    value={a.kind}
                    onChange={(e) => patchAction(i, { kind: e.target.value as ActionKind })}
                    className="h-9 flex-1 rounded-md border bg-background px-3 text-sm"
                  >
                    {(Object.keys(ACTION_LABEL) as ActionKind[]).map((k) => (
                      <option key={k} value={k}>
                        {ACTION_LABEL[k]}
                      </option>
                    ))}
                  </select>
                  {actions.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeAction(i)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {(a.kind === "SEND_EMAIL" ||
                  a.kind === "SEND_SMS" ||
                  a.kind === "SEND_WHATSAPP") && (
                  <div className="mt-2 grid gap-2">
                    {a.kind === "SEND_EMAIL" && (
                      <Input
                        placeholder="Oggetto"
                        value={a.params.subject ?? ""}
                        onChange={(e) => patchActionParams(i, { subject: e.target.value })}
                        maxLength={160}
                      />
                    )}
                    <Textarea
                      placeholder={`Testo del messaggio · usa {{firstName}} per personalizzare`}
                      rows={3}
                      value={a.params.body ?? ""}
                      onChange={(e) => patchActionParams(i, { body: e.target.value })}
                      maxLength={5000}
                    />
                  </div>
                )}

                {a.kind === "CREATE_COUPON" && (
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Input
                      placeholder="Nome coupon"
                      value={a.params.couponName ?? ""}
                      onChange={(e) => patchActionParams(i, { couponName: e.target.value })}
                    />
                    <select
                      value={a.params.couponKind ?? "PERCENT"}
                      onChange={(e) =>
                        patchActionParams(i, {
                          couponKind: e.target.value as ActionParams["couponKind"],
                        })
                      }
                      className="h-9 rounded-md border bg-background px-3 text-sm"
                    >
                      <option value="PERCENT">%</option>
                      <option value="FIXED">€</option>
                      <option value="FREE_ITEM">Omaggio</option>
                    </select>
                    <Input
                      type="number"
                      min={0}
                      placeholder="Valore"
                      value={a.params.couponValue ?? ""}
                      onChange={(e) =>
                        patchActionParams(i, { couponValue: Number(e.target.value) })
                      }
                    />
                    <Input
                      type="number"
                      min={1}
                      placeholder="Validità (gg)"
                      value={a.params.couponDays ?? 30}
                      onChange={(e) =>
                        patchActionParams(i, { couponDays: Number(e.target.value) })
                      }
                    />
                  </div>
                )}

                {a.kind === "ADD_GUEST_TAG" && (
                  <Input
                    className="mt-2"
                    placeholder="Tag (es. inattivo, vip-2026)"
                    value={a.params.tag ?? ""}
                    onChange={(e) => patchActionParams(i, { tag: e.target.value })}
                    maxLength={40}
                  />
                )}

                {a.kind === "CREATE_STAFF_TASK" && (
                  <div className="mt-2 grid gap-2">
                    <Input
                      placeholder="Titolo task"
                      value={a.params.title ?? ""}
                      onChange={(e) => patchActionParams(i, { title: e.target.value })}
                      maxLength={120}
                    />
                    <Textarea
                      placeholder="Dettagli (visibili allo staff)"
                      rows={2}
                      value={a.params.details ?? ""}
                      onChange={(e) => patchActionParams(i, { details: e.target.value })}
                      maxLength={500}
                    />
                  </div>
                )}
              </div>
            ))}
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
