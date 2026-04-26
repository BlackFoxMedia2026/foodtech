"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ERR: Record<string, string> = {
  wrong_venue: "Codice non valido per questo locale.",
  not_active: "Gift card non attiva.",
  expired: "Gift card scaduta.",
  insufficient_balance: "Saldo insufficiente per questo importo.",
  invalid_amount: "Importo non valido.",
};

export function GiftCardRedeemForm({ currency }: { currency: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/gift-cards/redeem", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        code: String(fd.get("code") ?? "").trim(),
        amount: Number(fd.get("amount")),
        reason: String(fd.get("reason") ?? "").trim() || null,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(ERR[b.error] ?? "Riscatto non riuscito.");
      return;
    }
    const data = await res.json();
    const balance = (data.card.balanceCents / 100).toFixed(2);
    setMessage(`Riscatto ok. Saldo residuo: ${balance} ${currency}.`);
    (e.target as HTMLFormElement).reset();
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-3">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="gr-code">Codice gift card</Label>
        <Input id="gr-code" name="code" required placeholder="GIFT-XXXX-XXXX" className="font-mono uppercase" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="gr-amount">Importo ({currency})</Label>
        <Input id="gr-amount" name="amount" type="number" min="0.01" step="0.01" required />
      </div>
      <div className="space-y-1.5 sm:col-span-3">
        <Label htmlFor="gr-reason">Note (es. tavolo 7, ordine #421)</Label>
        <Input id="gr-reason" name="reason" maxLength={200} />
      </div>
      <div className="sm:col-span-3 flex flex-wrap items-center justify-between gap-2">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {message && <p className="text-sm text-emerald-700">{message}</p>}
        <div className="ml-auto">
          <Button type="submit" variant="gold" disabled={busy}>
            <Receipt className="h-4 w-4" /> Riscatta
          </Button>
        </div>
      </div>
    </form>
  );
}
