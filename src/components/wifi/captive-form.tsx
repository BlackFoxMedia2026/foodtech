"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ERR: Record<string, string> = {
  contact_required: "Inserisci almeno email o telefono.",
  privacy_required: "Devi accettare la privacy.",
  invalid_input: "Controlla i dati inseriti.",
  invalid_json: "Invio non riuscito.",
  venue_not_found: "Locale non trovato.",
};

export function WifiCaptiveForm({
  slug,
  venueName,
  source,
  legalText,
  accent,
}: {
  slug: string;
  venueName: string;
  source: string | null;
  legalText?: string | null;
  accent?: string | null;
}) {
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: String(fd.get("name") ?? "").trim(),
      email: String(fd.get("email") ?? "").trim() || undefined,
      phone: String(fd.get("phone") ?? "").trim() || undefined,
      consentMarketing: fd.get("consentMarketing") === "on",
      consentPrivacy: fd.get("consentPrivacy") === "on",
      source,
    };
    const res = await fetch(`/api/wifi/${slug}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(ERR[b?.error] ?? "Connessione non riuscita.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <Card className="border-emerald-200 bg-emerald-50/50">
        <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          <p className="text-base font-medium">Sei online!</p>
          <p className="text-sm text-muted-foreground">
            Buona navigazione. Grazie {venueName} per averti accolto.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-foreground/10">
      <CardContent className="p-6">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="w-name">Nome</Label>
            <Input id="w-name" name="name" required minLength={2} maxLength={80} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="w-email">Email</Label>
              <Input id="w-email" name="email" type="email" placeholder="opzionale" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="w-phone">Telefono</Label>
              <Input id="w-phone" name="phone" placeholder="+39 …" />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">Inserisci almeno uno tra email e telefono.</p>

          <label className="flex items-start gap-2 text-xs">
            <input type="checkbox" name="consentPrivacy" required className="mt-0.5 h-3.5 w-3.5" />
            <span>
              {legalText ?? (
                <>
                  Ho letto l&apos;informativa privacy e acconsento al trattamento dei dati come previsto dal
                  GDPR.
                </>
              )}{" "}
              <span className="text-rose-600">*</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-xs">
            <input type="checkbox" name="consentMarketing" className="mt-0.5 h-3.5 w-3.5" />
            <span>
              Voglio ricevere comunicazioni e offerte da <strong>{venueName}</strong> via email/SMS.
            </span>
          </label>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            type="submit"
            variant="gold"
            className="w-full"
            disabled={busy}
            style={accent ? { background: accent, color: "#15161a" } : undefined}
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Connessione…
              </>
            ) : (
              "Connetti al Wi-Fi"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
