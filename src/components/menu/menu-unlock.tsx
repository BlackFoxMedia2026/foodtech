"use client";

import { useEffect, useState } from "react";
import { Mail, Phone, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const STORAGE_KEY = "tavolo.menu-unlock";

type Props = {
  venueSlug: string;
  venueName: string;
  mode: "PUBLIC" | "CONTACT" | "OPT_IN";
  menuKey: string;
};

export function MenuUnlock({ venueSlug, venueName, mode, menuKey }: Props) {
  const [unlocked, setUnlocked] = useState(mode === "PUBLIC");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trackedOnce, setTrackedOnce] = useState(false);

  useEffect(() => {
    if (mode === "PUBLIC") return;
    try {
      const raw = localStorage.getItem(`${STORAGE_KEY}:${venueSlug}`);
      if (raw) setUnlocked(true);
    } catch {
      // ignore
    }
  }, [mode, venueSlug]);

  // Track scan once per session for the public mode (anonymous)
  useEffect(() => {
    if (!unlocked || trackedOnce) return;
    setTrackedOnce(true);
    void fetch(`/api/menu-scan/${venueSlug}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ menuKey, source: "QR" }),
    });
  }, [unlocked, trackedOnce, venueSlug, menuKey]);

  if (unlocked) return null;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    const phone = String(fd.get("phone") ?? "").trim();
    const consent = fd.get("consent") === "on";
    if (!email && !phone) {
      setError("Inserisci email o telefono.");
      setBusy(false);
      return;
    }
    if (mode === "OPT_IN" && !consent) {
      setError("Conferma il consenso per ricevere il menu.");
      setBusy(false);
      return;
    }
    const res = await fetch(`/api/menu-scan/${venueSlug}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        menuKey,
        source: "QR",
        email: email || undefined,
        phone: phone || undefined,
        consentMarketing: consent,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError("Qualcosa è andato storto. Riprova.");
      return;
    }
    try {
      localStorage.setItem(`${STORAGE_KEY}:${venueSlug}`, "1");
    } catch {
      // ignore
    }
    setUnlocked(true);
  }

  return (
    <div className="rounded-2xl border bg-secondary/40 p-5">
      <div className="mb-3 flex items-center gap-2 text-sm">
        <Sparkles className="h-4 w-4 text-gilt-dark" />
        <span className="font-medium">Sblocca il menu di {venueName}</span>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        {mode === "OPT_IN"
          ? "Lascia il tuo contatto e riceverai una sorpresa: novità di stagione, eventi e un piccolo benvenuto al primo passaggio."
          : "Lascia un contatto: ti inviamo gli aggiornamenti del menu e nessuno spam."}
      </p>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="ml-email" className="text-xs">
            Email
          </Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input id="ml-email" name="email" type="email" className="pl-9" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ml-phone" className="text-xs">
            Telefono (opzionale)
          </Label>
          <div className="relative">
            <Phone className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input id="ml-phone" name="phone" className="pl-9" />
          </div>
        </div>
        <label className="flex items-start gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            name="consent"
            defaultChecked={mode !== "OPT_IN"}
            className="mt-0.5"
          />
          <span>
            Acconsento a ricevere comunicazioni promozionali da {venueName}. Posso annullare in
            qualsiasi momento.
          </span>
        </label>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" variant="gold" className="w-full" disabled={busy}>
          {busy ? "Sto sbloccando…" : "Vedi il menu"}
        </Button>
      </form>
    </div>
  );
}
