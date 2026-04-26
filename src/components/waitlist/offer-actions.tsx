"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const ERR: Record<string, string> = {
  not_found: "Offerta non trovata.",
  expired: "L'offerta è scaduta.",
  already_handled: "Hai già risposto a questa offerta.",
  rate_limited: "Troppe richieste, riprova tra poco.",
};

export function OfferActions({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"accepted" | "declined" | null>(null);

  async function call(action: "accept" | "decline") {
    setBusy(action);
    setError(null);
    const res = await fetch(`/api/waitlist/offer/${token}?action=${action}`, {
      method: "POST",
    });
    setBusy(null);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(ERR[b.error as string] ?? "Operazione non riuscita.");
      return;
    }
    setDone(action === "accept" ? "accepted" : "declined");
    router.refresh();
  }

  if (done === "accepted") {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
        ✓ Confermato! Lo staff ti aspetta all&apos;ingresso.
      </div>
    );
  }
  if (done === "declined") {
    return (
      <div className="rounded-md border bg-secondary px-3 py-2 text-sm text-muted-foreground">
        Va bene. Buona serata!
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="gold"
        className="w-full"
        onClick={() => call("accept")}
        disabled={busy !== null}
      >
        <Check className="h-4 w-4" /> Confermo, arrivo
      </Button>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => call("decline")}
        disabled={busy !== null}
      >
        <X className="h-4 w-4" /> Rinuncio, fa passare il prossimo
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
