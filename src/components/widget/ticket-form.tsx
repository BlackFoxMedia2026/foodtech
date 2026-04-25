"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";

const errorMessages: Record<string, string> = {
  not_found: "Esperienza non trovata.",
  event_past: "L'evento è già passato.",
  sold_out: "Posti esauriti.",
  invalid_input: "Controlla i dati inseriti.",
  invalid_json: "Invio non riuscito.",
};

export function TicketForm({
  slug,
  experienceSlug,
  priceCents,
  currency,
  maxPerOrder,
}: {
  slug: string;
  experienceSlug: string;
  priceCents: number;
  currency: string;
  maxPerOrder: number;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

  const totalCents = priceCents * quantity;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      buyerName: String(fd.get("buyerName") ?? "").trim(),
      buyerEmail: String(fd.get("buyerEmail") ?? "").trim(),
      quantity,
    };

    const res = await fetch(`/api/tickets/${slug}/${experienceSlug}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(errorMessages[body?.error] ?? "Operazione non riuscita.");
      return;
    }
    const { ticketId, checkoutUrl } = await res.json();
    if (checkoutUrl) {
      window.location.assign(checkoutUrl);
      return;
    }
    router.push(`/e/${slug}/${experienceSlug}/done?t=${ticketId}`);
  }

  return (
    <Card className="border-foreground/10">
      <CardContent className="p-6 md:p-8">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ticket-name">Nome e cognome</Label>
              <Input id="ticket-name" name="buyerName" required minLength={2} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ticket-email">Email</Label>
              <Input id="ticket-email" name="buyerEmail" type="email" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ticket-qty">Quantità</Label>
              <Input
                id="ticket-qty"
                name="quantity"
                type="number"
                min={1}
                max={maxPerOrder}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Math.min(maxPerOrder, Number(e.target.value) || 1)))}
              />
            </div>
            <div className="flex flex-col justify-end space-y-1">
              <p className="text-xs text-muted-foreground">Totale</p>
              <p className="text-display text-2xl">
                {priceCents === 0 ? "Gratis" : formatCurrency(totalCents, currency)}
              </p>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" variant="gold" disabled={submitting} className="w-full">
            {submitting
              ? "Invio…"
              : priceCents === 0
                ? "Riserva gratis"
                : `Vai al pagamento · ${formatCurrency(totalCents, currency)}`}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
