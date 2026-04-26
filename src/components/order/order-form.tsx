"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingBag, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatCurrency } from "@/lib/utils";

type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  allergens: string[];
  dietary: string[];
};

type Category = {
  id: string;
  name: string;
  items: MenuItem[];
};

type CartLine = { itemId: string; name: string; priceCents: number; quantity: number; notes?: string };

const ERR: Record<string, string> = {
  invalid_input: "Controlla i dati inseriti.",
  invalid_json: "Invio non riuscito.",
  venue_not_found: "Locale non trovato.",
};

function nextHourSlots(count = 12, stepMin = 15): { iso: string; label: string }[] {
  const out: { iso: string; label: string }[] = [];
  const now = new Date();
  // round up to next 15min step + 30min lead time
  now.setMinutes(now.getMinutes() + 30, 0, 0);
  const m = now.getMinutes();
  const round = Math.ceil(m / stepMin) * stepMin;
  now.setMinutes(round, 0, 0);
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getTime() + i * stepMin * 60_000);
    out.push({
      iso: d.toISOString(),
      label: d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
    });
  }
  return out;
}

export function OrderForm({
  slug,
  venueName,
  currency,
  categories,
  allergenLabels,
  dietaryLabels,
}: {
  slug: string;
  venueName: string;
  currency: string;
  categories: Category[];
  allergenLabels: Record<string, string>;
  dietaryLabels: Record<string, string>;
}) {
  const router = useRouter();
  const [cart, setCart] = useState<Map<string, CartLine>>(new Map());
  const [kind, setKind] = useState<"TAKEAWAY" | "DELIVERY">("TAKEAWAY");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slots = useMemo(() => nextHourSlots(20, 15), []);

  function add(item: MenuItem) {
    setCart((prev) => {
      const next = new Map(prev);
      const cur = next.get(item.id);
      if (cur) {
        next.set(item.id, { ...cur, quantity: cur.quantity + 1 });
      } else {
        next.set(item.id, {
          itemId: item.id,
          name: item.name,
          priceCents: item.priceCents,
          quantity: 1,
        });
      }
      return next;
    });
  }
  function remove(id: string) {
    setCart((prev) => {
      const next = new Map(prev);
      const cur = next.get(id);
      if (!cur) return prev;
      if (cur.quantity <= 1) next.delete(id);
      else next.set(id, { ...cur, quantity: cur.quantity - 1 });
      return next;
    });
  }

  const items = Array.from(cart.values());
  const total = items.reduce((s, i) => s + i.priceCents * i.quantity, 0);
  const empty = items.length === 0;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (empty) return;
    setError(null);
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      kind,
      customerName: String(fd.get("customerName") ?? "").trim(),
      phone: String(fd.get("phone") ?? "").trim(),
      email: String(fd.get("email") ?? "").trim() || null,
      address: kind === "DELIVERY" ? String(fd.get("address") ?? "").trim() || null : null,
      scheduledAt: String(fd.get("scheduledAt")),
      notes: String(fd.get("notes") ?? "").trim() || null,
      items: items.map((it) => ({
        menuItemId: it.itemId,
        name: it.name,
        priceCents: it.priceCents,
        quantity: it.quantity,
      })),
    };

    const res = await fetch(`/api/orders/public/${slug}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSubmitting(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(ERR[b?.error] ?? "Ordine non riuscito.");
      return;
    }
    const { reference } = await res.json();
    router.push(`/order/${slug}/done?ref=${reference}`);
  }

  return (
    <div className="grid gap-6 md:grid-cols-[1.6fr_1fr]">
      <div className="space-y-6">
        {categories.map((c) => (
          <section key={c.id} className="space-y-2">
            <h2 className="border-b pb-1 text-display text-xl">{c.name}</h2>
            <ul className="divide-y">
              {c.items.map((it) => (
                <li key={it.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-medium">{it.name}</p>
                    {it.description && <p className="text-xs text-muted-foreground">{it.description}</p>}
                    {(it.dietary.length || it.allergens.length) > 0 && (
                      <p className="mt-1 flex flex-wrap gap-1 text-[10px]">
                        {it.dietary.map((d) => (
                          <span key={d} className="rounded-full border border-emerald-300 bg-emerald-50 px-1.5 text-emerald-800">
                            {dietaryLabels[d] ?? d}
                          </span>
                        ))}
                        {it.allergens.slice(0, 3).map((a) => (
                          <span key={a} className="rounded-full border border-amber-300 bg-amber-50 px-1.5 text-amber-800">
                            {allergenLabels[a] ?? a}
                          </span>
                        ))}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm">{formatCurrency(it.priceCents, currency)}</span>
                    <Button type="button" variant="subtle" size="sm" onClick={() => add(it)}>
                      <Plus className="h-3.5 w-3.5" /> Aggiungi
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <Card className="sticky top-4 self-start">
        <CardHeader>
          <CardTitle>Carrello</CardTitle>
          <p className="text-xs text-muted-foreground">{items.reduce((s, i) => s + i.quantity, 0)} articoli</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {empty ? (
            <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
              Carrello vuoto. Aggiungi piatti dal menu.
            </p>
          ) : (
            <ul className="divide-y text-sm">
              {items.map((it) => (
                <li key={it.itemId} className="flex items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{it.name}</p>
                    <p className="text-xs text-muted-foreground">{formatCurrency(it.priceCents, currency)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => remove(it.itemId)}
                      className="grid h-6 w-6 place-items-center rounded-md border hover:bg-secondary"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-5 text-center">{it.quantity}</span>
                    <button
                      type="button"
                      onClick={() => add({ id: it.itemId, name: it.name, priceCents: it.priceCents, description: null, allergens: [], dietary: [] })}
                      className="grid h-6 w-6 place-items-center rounded-md border hover:bg-secondary"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="flex justify-between border-t pt-3 text-sm">
            <span>Totale</span>
            <span className="text-display text-lg">{formatCurrency(total, currency)}</span>
          </div>

          <form onSubmit={onSubmit} className="space-y-3 border-t pt-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setKind("TAKEAWAY")}
                className={cn(
                  "inline-flex items-center justify-center gap-1.5 rounded-md border py-2 text-xs",
                  kind === "TAKEAWAY"
                    ? "border-gilt bg-gilt/10 text-gilt-dark"
                    : "border-border text-muted-foreground",
                )}
              >
                <ShoppingBag className="h-3.5 w-3.5" /> Asporto
              </button>
              <button
                type="button"
                onClick={() => setKind("DELIVERY")}
                className={cn(
                  "inline-flex items-center justify-center gap-1.5 rounded-md border py-2 text-xs",
                  kind === "DELIVERY"
                    ? "border-gilt bg-gilt/10 text-gilt-dark"
                    : "border-border text-muted-foreground",
                )}
              >
                <Truck className="h-3.5 w-3.5" /> Consegna
              </button>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="o-name">Nome</Label>
              <Input id="o-name" name="customerName" required minLength={2} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="o-phone">Telefono</Label>
              <Input id="o-phone" name="phone" required placeholder="+39 …" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="o-email">Email (opzionale)</Label>
              <Input id="o-email" name="email" type="email" />
            </div>
            {kind === "DELIVERY" && (
              <div className="space-y-1.5">
                <Label htmlFor="o-addr">Indirizzo di consegna</Label>
                <Textarea id="o-addr" name="address" rows={2} required />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="o-time">{kind === "TAKEAWAY" ? "Ora di ritiro" : "Ora di consegna"}</Label>
              <select
                id="o-time"
                name="scheduledAt"
                required
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                {slots.map((s) => (
                  <option key={s.iso} value={s.iso}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="o-notes">Note (opzionale)</Label>
              <Textarea id="o-notes" name="notes" rows={2} placeholder="Allergie, citofono…" />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" variant="gold" disabled={submitting || empty} className="w-full">
              {submitting
                ? "Invio…"
                : `Conferma ordine · ${formatCurrency(total, currency)}`}
            </Button>
            <p className="text-[10px] text-muted-foreground">
              Pagamento al ritiro/consegna. Riceverai SMS quando l&apos;ordine è pronto.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
