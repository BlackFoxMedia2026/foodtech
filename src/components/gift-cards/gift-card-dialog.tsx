"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
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

export function GiftCardDialog({ currency }: { currency: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const expires = fd.get("expiresInDays");
    const payload = {
      amount: Number(fd.get("amount")),
      recipientName: String(fd.get("recipientName") ?? "").trim() || null,
      recipientEmail: String(fd.get("recipientEmail") ?? "").trim() || null,
      senderName: String(fd.get("senderName") ?? "").trim() || null,
      message: String(fd.get("message") ?? "").trim() || null,
      expiresInDays: expires ? Number(expires) : undefined,
    };
    const res = await fetch("/api/gift-cards", {
      method: "POST",
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="gold">
          <Plus className="h-4 w-4" /> Nuova gift card
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Emetti una gift card</DialogTitle>
          <DialogDescription>
            Crea un codice spendibile. Lo staff lo riscatta in cassa scalando l&apos;importo
            servito; il saldo rimane disponibile per i prossimi acquisti.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="gc-amount">Importo ({currency})</Label>
            <Input
              id="gc-amount"
              name="amount"
              type="number"
              min={5}
              step="5"
              defaultValue={50}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gc-exp">Validità (giorni)</Label>
            <Input
              id="gc-exp"
              name="expiresInDays"
              type="number"
              min={30}
              defaultValue={365}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gc-rname">Destinatario (opzionale)</Label>
            <Input id="gc-rname" name="recipientName" maxLength={80} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gc-remail">Email destinatario</Label>
            <Input id="gc-remail" name="recipientEmail" type="email" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="gc-sname">Da parte di (opzionale)</Label>
            <Input id="gc-sname" name="senderName" maxLength={80} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="gc-msg">Messaggio</Label>
            <Textarea id="gc-msg" name="message" rows={3} maxLength={500} />
          </div>
          {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Annulla
            </Button>
            <Button type="submit" variant="gold" disabled={busy}>
              {busy ? "Emissione…" : "Emetti gift card"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
