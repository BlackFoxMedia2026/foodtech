"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Trash2,
  Utensils,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ALLERGEN_LABEL, ALLERGENS, DIETARY, DIETARY_LABEL } from "@/server/menu";
import { cn, formatCurrency } from "@/lib/utils";

type Item = {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  available: boolean;
  ordering: number;
  allergens: string[];
  dietary: string[];
  imageUrl: string | null;
};

type Category = {
  id: string;
  name: string;
  menuKey: string;
  ordering: number;
  active: boolean;
  items: Item[];
};

const PRESET_KEYS = ["main", "lunch", "dinner", "tasting", "events", "drinks"];

export function MenuBuilder({
  initialCategories,
  menuKey,
  availableKeys,
  currency,
  venueSlug,
}: {
  initialCategories: Category[];
  menuKey: string;
  availableKeys: string[];
  currency: string;
  venueSlug: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  const allKeys = Array.from(new Set([...availableKeys, ...PRESET_KEYS]));

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function patchCategory(id: string, body: Record<string, unknown>) {
    setBusy(true);
    await fetch(`/api/menu/categories/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    refresh();
  }

  async function deleteCategory(id: string) {
    if (!confirm("Eliminare la categoria? Verranno cancellati tutti i piatti contenuti.")) return;
    setBusy(true);
    await fetch(`/api/menu/categories/${id}`, { method: "DELETE" });
    setBusy(false);
    refresh();
  }

  async function deleteItem(id: string) {
    if (!confirm("Eliminare il piatto?")) return;
    setBusy(true);
    await fetch(`/api/menu/items/${id}`, { method: "DELETE" });
    setBusy(false);
    refresh();
  }

  async function patchItem(id: string, body: Record<string, unknown>) {
    setBusy(true);
    await fetch(`/api/menu/items/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {allKeys.map((k) => (
          <Link
            key={k}
            href={`/menu?menu=${k}`}
            className={cn(
              "rounded-full border px-3 py-1 text-xs",
              k === menuKey
                ? "border-gilt bg-gilt/10 text-gilt-dark"
                : "border-border text-muted-foreground hover:bg-secondary",
            )}
          >
            {k}
            <span className="ml-1.5 opacity-60">
              {initialCategories.filter((c) => c.menuKey === k).length || ""}
            </span>
          </Link>
        ))}
        <NewCategoryDialog menuKey={menuKey} onCreated={refresh} />
      </div>

      {initialCategories.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nessuna categoria nel menu &quot;{menuKey}&quot;. Aggiungi la prima per iniziare.
        </p>
      ) : (
        <ol className="space-y-4">
          {initialCategories.map((c, ci) => (
            <li key={c.id} className="rounded-lg border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-7 w-7 place-items-center rounded-md bg-secondary text-xs">
                    {ci + 1}
                  </span>
                  <h3 className="text-lg font-medium">
                    {c.name}
                    {!c.active && <Badge tone="warning" className="ml-2">Nascosta</Badge>}
                  </h3>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy || ci === 0}
                    onClick={() => patchCategory(c.id, { ordering: c.ordering - 1 })}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy || ci === initialCategories.length - 1}
                    onClick={() => patchCategory(c.id, { ordering: c.ordering + 1 })}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => patchCategory(c.id, { active: !c.active })}
                  >
                    {c.active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                  <EditCategoryDialog category={c} onSaved={refresh} />
                  <Button variant="ghost" size="sm" onClick={() => deleteCategory(c.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="divide-y">
                {c.items.length === 0 && (
                  <p className="px-4 py-4 text-center text-xs text-muted-foreground">
                    Nessun piatto ancora. Aggiungilo qui sotto.
                  </p>
                )}
                {c.items.map((it) => (
                  <div key={it.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Utensils className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className={cn("font-medium", !it.available && "line-through text-muted-foreground")}>
                          {it.name}
                        </span>
                        <span className="text-sm">{formatCurrency(it.priceCents, it.currency)}</span>
                      </div>
                      {it.description && (
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{it.description}</p>
                      )}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1">
                        {it.dietary.map((d) => (
                          <Badge key={d} tone="success" className="text-[10px]">
                            {DIETARY_LABEL[d as keyof typeof DIETARY_LABEL] ?? d}
                          </Badge>
                        ))}
                        {it.allergens.map((a) => (
                          <Badge key={a} tone="warning" className="text-[10px]">
                            {ALLERGEN_LABEL[a as keyof typeof ALLERGEN_LABEL] ?? a}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => patchItem(it.id, { available: !it.available })}
                      >
                        {it.available ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                      <EditItemDialog item={it} categoryId={c.id} currency={currency} onSaved={refresh} />
                      <Button variant="ghost" size="sm" onClick={() => deleteItem(it.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="px-4 py-3">
                  <NewItemDialog categoryId={c.id} currency={currency} onCreated={refresh} />
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      <p className="text-xs text-muted-foreground">
        Anteprima pubblica: <code className="rounded bg-secondary px-1">/m/{venueSlug}?menu={menuKey}</code>
      </p>
    </div>
  );
}

function NewCategoryDialog({ menuKey, onCreated }: { menuKey: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="gold" size="sm">
          <Plus className="h-4 w-4" /> Nuova categoria
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuova categoria</DialogTitle>
          <DialogDescription>Sezione del menu (es. Antipasti, Cocktail, Dessert).</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const fd = new FormData(e.currentTarget);
            await fetch("/api/menu/categories", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                name: String(fd.get("name") ?? "").trim(),
                menuKey: String(fd.get("menuKey") ?? menuKey),
              }),
            });
            setBusy(false);
            setOpen(false);
            onCreated();
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="cat-name">Nome</Label>
            <Input id="cat-name" name="name" required maxLength={80} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cat-key">Menu</Label>
            <Input id="cat-key" name="menuKey" defaultValue={menuKey} maxLength={40} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Annulla
            </Button>
            <Button type="submit" variant="gold" disabled={busy}>
              {busy ? "Creazione…" : "Crea"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditCategoryDialog({ category, onSaved }: { category: Category; onSaved: () => void }) {
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
          <DialogTitle>Modifica categoria</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const fd = new FormData(e.currentTarget);
            await fetch(`/api/menu/categories/${category.id}`, {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                name: String(fd.get("name") ?? "").trim(),
                menuKey: String(fd.get("menuKey") ?? category.menuKey),
              }),
            });
            setBusy(false);
            setOpen(false);
            onSaved();
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="cat-edit-name">Nome</Label>
            <Input id="cat-edit-name" name="name" defaultValue={category.name} required maxLength={80} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cat-edit-key">Menu</Label>
            <Input id="cat-edit-key" name="menuKey" defaultValue={category.menuKey} maxLength={40} />
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

function NewItemDialog({
  categoryId,
  currency,
  onCreated,
}: {
  categoryId: string;
  currency: string;
  onCreated: () => void;
}) {
  return (
    <ItemDialog
      categoryId={categoryId}
      currency={currency}
      mode="create"
      onSaved={onCreated}
      trigger={
        <Button variant="subtle" size="sm">
          <Plus className="h-3.5 w-3.5" /> Aggiungi piatto
        </Button>
      }
    />
  );
}

function EditItemDialog({
  item,
  categoryId,
  currency,
  onSaved,
}: {
  item: Item;
  categoryId: string;
  currency: string;
  onSaved: () => void;
}) {
  return (
    <ItemDialog
      mode="edit"
      categoryId={categoryId}
      currency={currency}
      item={item}
      onSaved={onSaved}
      trigger={
        <Button variant="ghost" size="sm">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      }
    />
  );
}

function ItemDialog({
  trigger,
  mode,
  item,
  categoryId,
  currency,
  onSaved,
}: {
  trigger: React.ReactNode;
  mode: "create" | "edit";
  item?: Item;
  categoryId: string;
  currency: string;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [allergens, setAllergens] = useState<string[]>(item?.allergens ?? []);
  const [dietary, setDietary] = useState<string[]>(item?.dietary ?? []);

  function toggle(set: string[], v: string, fn: (arr: string[]) => void) {
    fn(set.includes(v) ? set.filter((x) => x !== v) : [...set, v]);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Nuovo piatto" : "Modifica piatto"}</DialogTitle>
          <DialogDescription>Allergeni e diete sono visibili nel menu pubblico.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const fd = new FormData(e.currentTarget);
            const priceEur = Number(fd.get("priceEur") ?? 0);
            const payload = {
              categoryId,
              name: String(fd.get("name") ?? "").trim(),
              description: String(fd.get("description") ?? "").trim() || null,
              priceCents: Math.max(0, Math.round(priceEur * 100)),
              currency,
              allergens,
              dietary,
              imageUrl: String(fd.get("imageUrl") ?? "").trim() || null,
            };
            const url = mode === "create" ? "/api/menu/items" : `/api/menu/items/${item!.id}`;
            await fetch(url, {
              method: mode === "create" ? "POST" : "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(payload),
            });
            setBusy(false);
            setOpen(false);
            onSaved();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="it-name">Nome</Label>
              <Input id="it-name" name="name" required defaultValue={item?.name ?? ""} maxLength={120} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="it-price">Prezzo (€)</Label>
              <Input
                id="it-price"
                name="priceEur"
                type="number"
                min={0}
                step={0.5}
                defaultValue={(item?.priceCents ?? 0) / 100}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-3">
              <Label htmlFor="it-desc">Descrizione</Label>
              <Textarea
                id="it-desc"
                name="description"
                rows={3}
                defaultValue={item?.description ?? ""}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-3">
              <Label htmlFor="it-img">Immagine (URL)</Label>
              <Input id="it-img" name="imageUrl" type="url" defaultValue={item?.imageUrl ?? ""} placeholder="https://…" />
            </div>
          </div>

          <div>
            <Label className="block">Diete</Label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {DIETARY.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggle(dietary, d, setDietary)}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-xs",
                    dietary.includes(d)
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                      : "border-border text-muted-foreground hover:bg-secondary",
                  )}
                >
                  {DIETARY_LABEL[d]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="block">Allergeni</Label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {ALLERGENS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => toggle(allergens, a, setAllergens)}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-xs",
                    allergens.includes(a)
                      ? "border-amber-300 bg-amber-50 text-amber-800"
                      : "border-border text-muted-foreground hover:bg-secondary",
                  )}
                >
                  {ALLERGEN_LABEL[a]}
                </button>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Annulla
            </Button>
            <Button type="submit" variant="gold" disabled={busy}>
              {busy ? "Salvataggio…" : mode === "create" ? "Crea" : "Salva"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
