"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";

export function VoiceActions({ kind, id }: { kind: "draft" | "missed"; id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function approve() {
    setBusy("approve");
    const res = await fetch(`/api/voice/drafts/${id}?action=approve`, { method: "POST" });
    setBusy(null);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      alert(`Impossibile creare la prenotazione: ${b.error ?? "errore"}`);
      return;
    }
    router.refresh();
  }

  async function reject() {
    setBusy("reject");
    await fetch(`/api/voice/drafts/${id}?action=reject`, { method: "POST" });
    setBusy(null);
    router.refresh();
  }

  async function callback() {
    setBusy("callback");
    await fetch(`/api/voice/missed/${id}`, { method: "POST" });
    setBusy(null);
    router.refresh();
  }

  if (kind === "draft") {
    return (
      <div className="flex items-center gap-2">
        <Button size="sm" variant="gold" onClick={approve} disabled={busy !== null}>
          <Check className="h-3.5 w-3.5" /> Approva
        </Button>
        <Button size="sm" variant="ghost" onClick={reject} disabled={busy !== null}>
          <X className="h-3.5 w-3.5" /> Rifiuta
        </Button>
      </div>
    );
  }
  return (
    <Button size="sm" variant="outline" onClick={callback} disabled={busy !== null}>
      <PhoneCall className="h-3.5 w-3.5" /> Richiama
    </Button>
  );
}
