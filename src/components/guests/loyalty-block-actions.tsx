"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Plus, ShieldCheck, ShieldOff, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoyaltyBlockActions({
  guestId,
  blocked,
  blockedReason,
  canEdit,
  canBlock,
}: {
  guestId: string;
  blocked: boolean;
  blockedReason: string | null;
  canEdit: boolean;
  canBlock: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAdjust, setShowAdjust] = useState(false);

  async function adjust(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy("adjust");
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch(`/api/guests/${guestId}/loyalty`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        delta: Number(fd.get("delta")),
        reason: String(fd.get("reason") ?? "").trim(),
      }),
    });
    setBusy(null);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(
        b.error === "negative_balance"
          ? "Non bastano punti per questo riscatto."
          : "Operazione non riuscita.",
      );
      return;
    }
    setShowAdjust(false);
    router.refresh();
  }

  async function toggleBlock() {
    const reason = blocked
      ? null
      : prompt("Motivo del blocco?", "Comportamento inappropriato");
    if (!blocked && reason === null) return;
    setBusy("block");
    setError(null);
    const res = await fetch(`/api/guests/${guestId}/block`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ blocked: !blocked, reason }),
    });
    setBusy(null);
    if (!res.ok) {
      setError("Operazione non riuscita.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {canEdit && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowAdjust((v) => !v)}
          >
            <Sparkles className="h-3.5 w-3.5" /> Punti loyalty
          </Button>
        )}
        {canBlock && (
          <Button
            type="button"
            variant={blocked ? "outline" : "ghost"}
            size="sm"
            onClick={toggleBlock}
            disabled={busy !== null}
          >
            {blocked ? (
              <>
                <ShieldCheck className="h-3.5 w-3.5" /> Sblocca ospite
              </>
            ) : (
              <>
                <ShieldOff className="h-3.5 w-3.5" /> Blocca ospite
              </>
            )}
          </Button>
        )}
      </div>

      {blocked && (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          <Ban className="mr-1 inline h-3 w-3" />
          Bloccato. {blockedReason ?? ""}
        </p>
      )}

      {showAdjust && (
        <form onSubmit={adjust} className="space-y-2 rounded-md border p-3 text-xs">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="lp-delta" className="text-xs">
                Variazione punti (+/-)
              </Label>
              <Input id="lp-delta" name="delta" type="number" required defaultValue={50} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="lp-reason" className="text-xs">
                Motivo
              </Label>
              <Input
                id="lp-reason"
                name="reason"
                required
                minLength={2}
                maxLength={200}
                placeholder="Riscatto coppa champagne, regalo compleanno…"
              />
            </div>
          </div>
          {error && <p className="text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowAdjust(false)}>
              Annulla
            </Button>
            <Button type="submit" variant="gold" size="sm" disabled={busy !== null}>
              <Plus className="h-3.5 w-3.5" />
              Applica
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
