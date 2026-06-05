"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Sparkles, Trash2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";

type UpsellHint = {
  reason:
    | "wine_pairing"
    | "white_wine_pairing"
    | "coffee_after"
    | "antipasto"
    | "dessert"
    | "dietary_complement";
  message: string;
  suggestedItems: { id: string; name: string; priceCents: number }[];
};

type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
};

type Category = { id: string; name: string; items: MenuItem[] };

type PreorderItem = {
  id?: string;
  menuItemId: string | null;
  name: string;
  priceCents: number;
  quantity: number;
  notes: string | null;
};

type Props = {
  bookingId?: string;
  reference?: string;
  scope: "admin" | "guest";
  initial: {
    status?: string;
    notes?: string | null;
    items?: PreorderItem[];
  } | null;
  menu: Category[];
  currency: string;
  locked?: boolean;
};

const ERR: Record<string, string> = {
  not_found: "Prenotazione non trovata.",
  locked: "Prenotazione chiusa, impossibile modificare.",
  too_late: "Mancano meno di 2 ore: contatta il locale.",
  rate_limited: "Hai fatto troppe modifiche, attendi un istante.",
};

export function PreorderEditor({
  bookingId,
  reference,
  scope,
  initial,
  menu,
  currency,
  locked,
}: Props) {
  const router = useRouter();
  const [items, setItems] = useState<PreorderItem[]>(initial?.items ?? []);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [status, setStatus] = useState(initial?.status ?? "DRAFT");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const total = useMemo(
    () => items.reduce((s, it) => s + it.priceCents * it.quantity, 0),
    [items],
  );

  // Smart upsell suggestions. Admin-only (the public guest endpoint runs
  // without a cookie-based venue context, so the API would 403). The fetch
  // is debounced 500ms on every cart mutation; if no hints come back we
  // hide the panel entirely.
  const [upsellHints, setUpsellHints] = useState<UpsellHint[]>([]);
  const upsellTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const upsellAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (scope !== "admin" || !bookingId) return;
    if (upsellTimer.current) clearTimeout(upsellTimer.current);
    if (items.length === 0) {
      setUpsellHints([]);
      return;
    }
    upsellTimer.current = setTimeout(async () => {
      upsellAbort.current?.abort();
      const ac = new AbortController();
      upsellAbort.current = ac;
      try {
        const res = await fetch(
          `/api/preorders/${bookingId}/upsell-suggestions`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              currentItems: items
                .filter((it) => it.menuItemId)
                .map((it) => ({
                  menuItemId: it.menuItemId,
                  quantity: it.quantity,
                })),
            }),
            signal: ac.signal,
          },
        );
        if (!res.ok) {
          setUpsellHints([]);
          return;
        }
        const data = (await res.json()) as { hints?: UpsellHint[] };
        setUpsellHints(data.hints ?? []);
      } catch {
        // network/abort — leave previous hints alone if abort, clear on error
      }
    }, 500);
    return () => {
      if (upsellTimer.current) clearTimeout(upsellTimer.current);
    };
  }, [items, bookingId, scope]);

  function addSuggested(
    item: { id: string; name: string; priceCents: number },
    reason: UpsellHint["reason"],
  ) {
    setItems((prev) => {
      const existing = prev.find((p) => p.menuItemId === item.id);
      if (existing) {
        return prev.map((p) =>
          p === existing ? { ...p, quantity: p.quantity + 1 } : p,
        );
      }
      return [
        ...prev,
        {
          menuItemId: item.id,
          name: item.name,
          priceCents: item.priceCents,
          quantity: 1,
          notes: null,
        },
      ];
    });
    if (scope === "admin" && bookingId) {
      void fetch(`/api/preorders/${bookingId}/upsell-click`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason, menuItemId: item.id }),
      }).catch(() => {});
    }
  }

  function addFromMenu(item: MenuItem) {
    setItems((prev) => {
      const existing = prev.find((p) => p.menuItemId === item.id);
      if (existing) {
        return prev.map((p) =>
          p === existing ? { ...p, quantity: p.quantity + 1 } : p,
        );
      }
      return [
        ...prev,
        {
          menuItemId: item.id,
          name: item.name,
          priceCents: item.priceCents,
          quantity: 1,
          notes: null,
        },
      ];
    });
  }

  function patchItem(idx: number, patch: Partial<PreorderItem>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function addCustom() {
    setItems((prev) => [
      ...prev,
      { menuItemId: null, name: "Voce libera", priceCents: 0, quantity: 1, notes: null },
    ]);
  }

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(null);
    const url =
      scope === "admin"
        ? `/api/bookings/${bookingId}/preorder`
        : `/api/bookings/manage/${reference}/preorder`;
    const res = await fetch(url, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        status: scope === "admin" ? status : undefined,
        notes: notes || null,
        items: items.map((it) => ({
          menuItemId: it.menuItemId,
          name: it.name,
          priceCents: it.priceCents,
          quantity: it.quantity,
          notes: it.notes,
        })),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(ERR[b.error] ?? "Salvataggio non riuscito.");
      return;
    }
    setSaved(`Pre-order salvato. Totale ${formatCurrency(total, currency)}.`);
    router.refresh();
  }

  if (locked && items.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        Pre-order non disponibile (prenotazione chiusa o troppo vicina al servizio).
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nessuna voce ancora. Aggiungi piatti dal menu sotto o una voce libera.
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {items.map((it, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2 p-2 text-sm">
              <Input
                value={it.name}
                onChange={(e) => patchItem(i, { name: e.target.value })}
                disabled={locked}
                className="min-w-[180px] flex-1"
              />
              <Input
                type="number"
                min={1}
                max={50}
                value={it.quantity}
                onChange={(e) => patchItem(i, { quantity: Number(e.target.value) || 1 })}
                disabled={locked}
                className="w-16"
              />
              <Input
                type="number"
                min={0}
                step="0.5"
                value={(it.priceCents / 100).toFixed(2)}
                onChange={(e) =>
                  patchItem(i, {
                    priceCents: Math.round(Number(e.target.value) * 100) || 0,
                  })
                }
                disabled={locked}
                className="w-24"
              />
              <Input
                placeholder="Note"
                value={it.notes ?? ""}
                onChange={(e) => patchItem(i, { notes: e.target.value || null })}
                disabled={locked}
                className="w-40"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeItem(i)}
                disabled={locked}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {!locked && (
        <div className="space-y-2">
          <Label className="text-xs">Aggiungi dal menu</Label>
          <div className="grid gap-2 max-h-64 overflow-y-auto rounded-md border p-2">
            {menu.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Il menu del locale non è ancora pubblicato.
              </p>
            ) : (
              menu.map((cat) => (
                <details key={cat.id} className="rounded border" open>
                  <summary className="cursor-pointer bg-secondary px-2 py-1 text-xs font-medium">
                    {cat.name}
                  </summary>
                  <ul className="divide-y text-xs">
                    {cat.items.length === 0 && (
                      <li className="px-2 py-1 text-muted-foreground">—</li>
                    )}
                    {cat.items.map((it) => (
                      <li
                        key={it.id}
                        className="flex items-center justify-between gap-2 px-2 py-1.5"
                      >
                        <div className="min-w-0">
                          <p className="font-medium">{it.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {formatCurrency(it.priceCents, it.currency)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addFromMenu(it)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </details>
              ))
            )}
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={addCustom}>
            <Plus className="h-3.5 w-3.5" /> Voce libera
          </Button>
        </div>
      )}

      {!locked && upsellHints.length > 0 && (
        <div className="rounded-xl border border-gilt/30 bg-gilt/[0.04] p-3">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-gilt-dark" />
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-gilt-dark">
              Suggerimenti del concierge
            </p>
          </div>
          <div className="space-y-3">
            {upsellHints.map((hint) => (
              <div key={hint.reason} className="space-y-1.5">
                <p className="text-xs italic text-foreground/80">{hint.message}</p>
                <div className="flex flex-wrap gap-1.5">
                  {hint.suggestedItems.map((sugg) => (
                    <button
                      key={sugg.id}
                      type="button"
                      onClick={() => addSuggested(sugg, hint.reason)}
                      className="group flex items-center gap-1.5 rounded-lg border border-gilt/40 bg-background px-2 py-1 text-[11px] transition hover:bg-gilt/10"
                    >
                      <span className="font-medium">{sugg.name}</span>
                      <span className="text-muted-foreground">
                        {formatCurrency(sugg.priceCents, currency)}
                      </span>
                      <span className="grid h-4 w-4 place-items-center rounded-full bg-gilt/15 text-gilt-dark group-hover:bg-gilt/30">
                        <Plus className="h-2.5 w-2.5" />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="po-notes" className="text-xs">
          Note per la cucina
        </Label>
        <Textarea
          id="po-notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={500}
          disabled={locked}
        />
      </div>

      {scope === "admin" && (
        <div className="flex items-center gap-2 text-xs">
          <Label htmlFor="po-status">Stato</Label>
          <select
            id="po-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            disabled={locked}
            className="h-8 rounded-md border bg-background px-2 text-xs"
          >
            <option value="DRAFT">Bozza</option>
            <option value="CONFIRMED">Confermato</option>
            <option value="PREPARED">Pronto</option>
            <option value="CANCELLED">Annullato</option>
          </select>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && <p className="text-sm text-emerald-700">{saved}</p>}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
        <Badge tone="gold" className="text-sm">
          Totale stimato: {formatCurrency(total, currency)}
        </Badge>
        {!locked && (
          <Button type="button" variant="gold" onClick={save} disabled={busy}>
            <Save className="h-4 w-4" />
            {busy ? "Salvataggio…" : "Salva pre-order"}
          </Button>
        )}
      </div>
    </div>
  );
}
