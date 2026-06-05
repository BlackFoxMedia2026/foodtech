"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Crown, Search, Tag, Users, X } from "lucide-react";
import type { Guest } from "@prisma/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LoyaltyPill, type LoyaltyKey } from "@/components/ui/status-pill";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatDate, initials } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function GuestsTable({ rows }: { rows: Guest[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<
    "tag" | "tier-vip" | "tier-regular" | "optin-on" | "optin-off" | null
  >(null);

  function onSearch(q: string) {
    const sp = new URLSearchParams(search);
    if (q) sp.set("q", q);
    else sp.delete("q");
    router.push(`${pathname}?${sp.toString()}`);
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === rows.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rows.map((g) => g.id)));
    }
  }

  function clearSelection() {
    setSelected(new Set());
  }

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const selectedIds = useMemo(() => Array.from(selected), [selected]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-tertiary" />
        <input
          defaultValue={search.get("q") ?? ""}
          placeholder="Cerca per nome, email o telefono…"
          onChange={(e) => onSearch(e.target.value)}
          className="h-10 w-full rounded-lg border border-border bg-card pl-10 pr-3 text-sm transition-colors placeholder:text-tertiary focus:border-border-strong focus:outline-none"
        />
      </div>

      {/* Bulk toolbar — appare solo se >=1 selezionato */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gilt/30 bg-gilt/[0.08] px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-display text-numeric text-base font-medium text-gilt-light">
              {selected.size}
            </span>
            <span className="text-secondary">
              {selected.size === 1 ? "ospite selezionato" : "ospiti selezionati"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={() => setBulkAction("tag")}>
              <Tag className="h-3.5 w-3.5" /> Aggiungi tag
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBulkAction("tier-vip")}
              title="Imposta tier loyalty a VIP per i selezionati"
            >
              <Crown className="h-3.5 w-3.5" /> Tier VIP
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBulkAction("tier-regular")}
            >
              Tier Regular
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBulkAction("optin-on")}
            >
              Opt-in ON
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBulkAction("optin-off")}
            >
              Opt-in OFF
            </Button>
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              <X className="h-3.5 w-3.5" /> Pulisci
            </Button>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nessun ospite trovato"
          description="Prova con un nome, telefono o email diversi, oppure cambia segmento."
        />
      ) : (
        <div className="panel overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-[hsl(var(--surface-sunken))]/60 text-[10.5px] font-medium uppercase tracking-[0.14em] text-tertiary">
              <tr>
                <th className="w-10 px-3 py-3 text-center font-medium">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Seleziona tutti"
                    className="h-4 w-4 cursor-pointer rounded border-input accent-gilt"
                  />
                </th>
                <th className="px-4 py-3 text-left font-medium">Ospite</th>
                <th className="px-4 py-3 text-left font-medium">Contatti</th>
                <th className="px-4 py-3 text-right font-medium">Visite</th>
                <th className="px-4 py-3 text-right font-medium">Spesa totale</th>
                <th className="px-4 py-3 text-left font-medium">Ultima visita</th>
                <th className="px-4 py-3 text-left font-medium">Fedeltà</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((g) => {
                const name = `${g.firstName} ${g.lastName ?? ""}`.trim();
                const totalSpendCents = Math.round(Number(g.totalSpend) * 100);
                const isSelected = selected.has(g.id);
                return (
                  <tr
                    key={g.id}
                    className={cn(
                      "cursor-pointer transition-colors",
                      isSelected ? "bg-gilt/[0.05]" : "hover:bg-secondary/40",
                    )}
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      if (target.closest("input,a,button")) return;
                      router.push(`/guests/${g.id}`);
                    }}
                  >
                    <td className="w-10 px-3 py-3.5 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggle(g.id)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Seleziona ${name}`}
                        className="h-4 w-4 cursor-pointer rounded border-input accent-gilt"
                      />
                    </td>
                    <td className="px-4 py-3.5">
                      <Link
                        href={`/guests/${g.id}`}
                        className="flex items-center gap-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Avatar className="h-9 w-9">
                          <AvatarFallback>{initials(name)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{name}</p>
                          {g.tags?.length > 0 && (
                            <div className="mt-0.5 flex flex-wrap gap-1">
                              {g.tags.slice(0, 3).map((t) => (
                                <span
                                  key={t}
                                  className="inline-flex items-center rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-secondary"
                                >
                                  {t}
                                </span>
                              ))}
                              {g.tags.length > 3 && (
                                <span className="text-[10px] text-tertiary">
                                  +{g.tags.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="truncate text-foreground">{g.email ?? "—"}</p>
                      {g.phone && <p className="truncate text-xs text-tertiary">{g.phone}</p>}
                    </td>
                    <td className="px-4 py-3.5 text-right text-numeric font-medium">
                      {g.totalVisits}
                    </td>
                    <td className="px-4 py-3.5 text-right text-numeric font-medium">
                      {totalSpendCents > 0 ? formatCurrency(totalSpendCents) : "—"}
                    </td>
                    <td className="px-4 py-3.5 text-tertiary">
                      {g.lastVisitAt ? formatDate(g.lastVisitAt) : "—"}
                    </td>
                    <td className="px-4 py-3.5">
                      <LoyaltyPill loyalty={g.loyaltyTier as LoyaltyKey} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Bulk action dialogs */}
      <BulkTagDialog
        open={bulkAction === "tag"}
        onOpenChange={(o) => !o && setBulkAction(null)}
        ids={selectedIds}
        onDone={() => {
          setBulkAction(null);
          clearSelection();
          router.refresh();
        }}
      />
      <BulkConfirm
        open={bulkAction === "tier-vip"}
        onOpenChange={(o) => !o && setBulkAction(null)}
        ids={selectedIds}
        action={{ kind: "setLoyaltyTier", tier: "VIP" }}
        title={`Imposta tier VIP a ${selectedIds.length} ospit${selectedIds.length === 1 ? "e" : "i"}?`}
        description="I selezionati saranno marcati VIP. L'operazione è reversibile manualmente."
        onDone={() => {
          setBulkAction(null);
          clearSelection();
          router.refresh();
        }}
      />
      <BulkConfirm
        open={bulkAction === "tier-regular"}
        onOpenChange={(o) => !o && setBulkAction(null)}
        ids={selectedIds}
        action={{ kind: "setLoyaltyTier", tier: "REGULAR" }}
        title={`Imposta tier Regular a ${selectedIds.length} ospit${selectedIds.length === 1 ? "e" : "i"}?`}
        description="I selezionati saranno marcati Regular."
        onDone={() => {
          setBulkAction(null);
          clearSelection();
          router.refresh();
        }}
      />
      <BulkConfirm
        open={bulkAction === "optin-on"}
        onOpenChange={(o) => !o && setBulkAction(null)}
        ids={selectedIds}
        action={{ kind: "setMarketingOptIn", optIn: true }}
        title={`Marketing opt-in ON per ${selectedIds.length} ospit${selectedIds.length === 1 ? "e" : "i"}?`}
        description="Solo per ospiti che hanno espresso consenso in altri canali. GDPR: assicurati di avere prova del consenso."
        onDone={() => {
          setBulkAction(null);
          clearSelection();
          router.refresh();
        }}
      />
      <BulkConfirm
        open={bulkAction === "optin-off"}
        onOpenChange={(o) => !o && setBulkAction(null)}
        ids={selectedIds}
        action={{ kind: "setMarketingOptIn", optIn: false }}
        title={`Marketing opt-in OFF per ${selectedIds.length} ospit${selectedIds.length === 1 ? "e" : "i"}?`}
        description="Revoca il consenso marketing. I selezionati non riceveranno più campagne."
        onDone={() => {
          setBulkAction(null);
          clearSelection();
          router.refresh();
        }}
      />
    </div>
  );
}

function BulkTagDialog({
  open,
  onOpenChange,
  ids,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  ids: string[];
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function apply(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const tag = String(fd.get("tag") ?? "").trim().toLowerCase();
    if (!tag) {
      setBusy(false);
      return;
    }
    const res = await fetch("/api/guests/bulk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids, action: { kind: "addTag", tag } }),
    });
    setBusy(false);
    if (!res.ok) {
      setError("Operazione fallita.");
      return;
    }
    const data = await res.json();
    setFeedback(
      `Tag “${tag}” aggiunto a ${data.updated} ${data.updated === 1 ? "ospite" : "ospiti"}.`,
    );
    setTimeout(() => onDone(), 1000);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Aggiungi tag a {ids.length} ospit{ids.length === 1 ? "e" : "i"}
          </DialogTitle>
          <DialogDescription>
            Il tag verrà aggiunto solo agli ospiti che non lo hanno già.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={apply} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="bulk-tag">Tag</Label>
            <Input
              id="bulk-tag"
              name="tag"
              placeholder="es. estate2026"
              maxLength={32}
              required
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-status-no-show">{error}</p>}
          {feedback && <p className="text-sm text-status-confirmed">{feedback}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
            <Button type="submit" variant="gold" disabled={busy}>
              {busy ? "Applicazione…" : "Applica"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BulkConfirm({
  open,
  onOpenChange,
  ids,
  action,
  title,
  description,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  ids: string[];
  action:
    | { kind: "setLoyaltyTier"; tier: "NEW" | "REGULAR" | "VIP" | "AMBASSADOR" }
    | { kind: "setMarketingOptIn"; optIn: boolean };
  title: string;
  description: string;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/guests/bulk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids, action }),
    });
    setBusy(false);
    if (!res.ok) {
      setError("Operazione fallita.");
      return;
    }
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm text-status-no-show">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button type="button" variant="gold" disabled={busy} onClick={apply}>
            {busy ? "Applicazione…" : "Conferma"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
