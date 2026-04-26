"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Minus, Plus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";

type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  dietary: string[];
  allergens: string[];
};

type Category = { id: string; name: string; items: MenuItem[] };

type CartItem = { id: string; name: string; priceCents: number; quantity: number; notes: string };

const ERR: Record<string, string> = {
  venue_not_found: "Locale non trovato.",
  table_not_found: "Tavolo non valido.",
  empty_items: "Aggiungi almeno un piatto.",
  rate_limited: "Troppe richieste, attendi un istante.",
  invalid_input: "Controlla la selezione.",
};

export function TableOrderForm({
  venueSlug,
  tableLabel,
  currency,
  categories,
}: {
  venueSlug: string;
  tableLabel: string;
  currency: string;
  categories: Category[];
}) {
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [notes, setNotes] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{
    reference: string;
    totalCents: number;
  } | null>(null);

  const total = useMemo(
    () => Object.values(cart).reduce((s, i) => s + i.priceCents * i.quantity, 0),
    [cart],
  );
  const itemCount = useMemo(
    () => Object.values(cart).reduce((s, i) => s + i.quantity, 0),
    [cart],
  );

  function add(item: MenuItem) {
    setCart((prev) => {
      const existing = prev[item.id];
      return {
        ...prev,
        [item.id]: existing
          ? { ...existing, quantity: existing.quantity + 1 }
          : {
              id: item.id,
              name: item.name,
              priceCents: item.priceCents,
              quantity: 1,
              notes: "",
            },
      };
    });
  }

  function dec(id: string) {
    setCart((prev) => {
      const existing = prev[id];
      if (!existing) return prev;
      if (existing.quantity <= 1) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: { ...existing, quantity: existing.quantity - 1 } };
    });
  }

  function patchNotes(id: string, value: string) {
    setCart((prev) => {
      const existing = prev[id];
      if (!existing) return prev;
      return { ...prev, [id]: { ...existing, notes: value } };
    });
  }

  async function send() {
    if (Object.keys(cart).length === 0) {
      setError(ERR.empty_items);
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch(
      `/api/orders/table/${venueSlug}/${encodeURIComponent(tableLabel)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          customerName: name.trim() || null,
          notes: notes.trim() || null,
          items: Object.values(cart).map((it) => ({
            menuItemId: it.id,
            quantity: it.quantity,
            notes: it.notes.trim() || null,
          })),
        }),
      },
    );
    setBusy(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(ERR[b.error as string] ?? "Invio non riuscito.");
      return;
    }
    const j = (await res.json()) as { reference: string; totalCents: number };
    setConfirmation(j);
    setCart({});
    setNotes("");
  }

  if (confirmation) {
    return (
      <Card className="border-emerald-200 bg-emerald-50/50">
        <CardContent className="space-y-3 p-6 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
          <p className="text-base font-medium">Ordine ricevuto in cucina!</p>
          <p className="text-sm text-muted-foreground">
            Riferimento{" "}
            <span className="font-mono">
              {confirmation.reference.slice(-8).toUpperCase()}
            </span>
            {" · "}totale stimato {formatCurrency(confirmation.totalCents, currency)}
          </p>
          <p className="text-xs text-muted-foreground">
            Pagamento al tavolo a fine servizio. Lo staff ti porterà il conto.
          </p>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setConfirmation(null)}
            className="mt-2"
          >
            Aggiungi altro
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3 pb-32">
      {categories.map((c) => (
        <details key={c.id} className="rounded-md border" open>
          <summary className="cursor-pointer bg-secondary px-3 py-2 text-sm font-medium">
            {c.name}
          </summary>
          <ul className="divide-y">
            {c.items.length === 0 ? (
              <li className="px-3 py-2 text-xs text-muted-foreground">—</li>
            ) : (
              c.items.map((it) => {
                const inCart = cart[it.id];
                return (
                  <li key={it.id} className="space-y-1 px-3 py-3 text-sm">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="font-medium">{it.name}</p>
                      <span className="shrink-0 text-base">
                        {formatCurrency(it.priceCents, it.currency)}
                      </span>
                    </div>
                    {it.description && (
                      <p className="text-xs text-muted-foreground">{it.description}</p>
                    )}
                    {(it.dietary.length > 0 || it.allergens.length > 0) && (
                      <div className="flex flex-wrap items-center gap-1 text-[10px]">
                        {it.dietary.map((d) => (
                          <Badge key={d} tone="success">
                            {d}
                          </Badge>
                        ))}
                        {it.allergens.map((a) => (
                          <Badge key={a} tone="warning">
                            {a}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2 pt-1">
                      {inCart ? (
                        <div className="inline-flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => dec(it.id)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="min-w-[1.5rem] text-center font-medium">
                            {inCart.quantity}
                          </span>
                          <Button
                            type="button"
                            variant="gold"
                            size="icon"
                            onClick={() => add(it)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button type="button" variant="outline" size="sm" onClick={() => add(it)}>
                          <Plus className="h-3.5 w-3.5" /> Aggiungi
                        </Button>
                      )}
                      {inCart && (
                        <Input
                          placeholder="Note (es. senza glutine)"
                          value={inCart.notes}
                          onChange={(e) => patchNotes(it.id, e.target.value)}
                          maxLength={200}
                          className="h-8 max-w-[60%] text-xs"
                        />
                      )}
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </details>
      ))}

      <div className="space-y-2 rounded-md border bg-background p-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="to-name" className="text-xs">
              Nome (opzionale)
            </Label>
            <Input
              id="to-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              placeholder="Es. Lucia"
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="to-notes" className="text-xs">
            Note generali
          </Label>
          <Textarea
            id="to-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
            placeholder="Allergie, intolleranze, richieste speciali"
          />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background p-3 shadow-lg">
        <div className="mx-auto flex max-w-md items-center justify-between gap-2">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              {itemCount} {itemCount === 1 ? "pezzo" : "pezzi"}
            </p>
            <p className="text-display text-xl">{formatCurrency(total, currency)}</p>
          </div>
          <Button
            type="button"
            variant="gold"
            onClick={send}
            disabled={busy || itemCount === 0}
            className="h-12 px-6"
          >
            <Send className="h-4 w-4" /> {busy ? "Invio…" : "Manda in cucina"}
          </Button>
        </div>
      </div>
    </div>
  );
}
