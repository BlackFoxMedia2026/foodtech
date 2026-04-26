"use client";

import { useEffect, useState } from "react";
import { Palette, Save } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Brand = {
  logoUrl: string | null;
  accent: string;
  footnote: string | null;
};

const DEFAULT_ACCENT = "#c9a25a";

export function BrandingCard({ initial }: { initial: Brand | null }) {
  const [logoUrl, setLogoUrl] = useState(initial?.logoUrl ?? "");
  const [accent, setAccent] = useState(initial?.accent ?? DEFAULT_ACCENT);
  const [footnote, setFootnote] = useState(initial?.footnote ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initial) {
      setLogoUrl(initial.logoUrl ?? "");
      setAccent(initial.accent ?? DEFAULT_ACCENT);
      setFootnote(initial.footnote ?? "");
    }
  }, [initial]);

  async function save() {
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/branding", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        brandLogoUrl: logoUrl.trim() || null,
        brandAccent: accent,
        brandFootnote: footnote.trim() || null,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b?.error === "invalid_input" ? "Controlla i campi." : "Salvataggio non riuscito.");
      return;
    }
    setMessage("Brand aggiornato. Le pagine pubbliche lo mostrano già.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-4 w-4" /> Brand del locale
        </CardTitle>
        <CardDescription>
          Logo + colore accento + footer applicati automaticamente al widget di prenotazione,
          gift card, manage page, offerte waitlist e ordini al tavolo.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="brand-logo">Logo URL (opzionale)</Label>
            <Input
              id="brand-logo"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://www.tuolocale.it/logo.png"
              maxLength={400}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="brand-accent">Colore accento</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={accent.startsWith("#") ? accent : `#${accent}`}
                onChange={(e) => setAccent(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border"
              />
              <Input
                id="brand-accent"
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
                maxLength={9}
                className="font-mono text-xs"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="brand-footnote">Footer pagine pubbliche (opzionale)</Label>
            <Textarea
              id="brand-footnote"
              rows={2}
              value={footnote}
              onChange={(e) => setFootnote(e.target.value)}
              maxLength={280}
              placeholder="Es. Casa Aurora · dal 1996 · Via dei Fiori 12, Milano"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {message && <p className="text-sm text-emerald-700">{message}</p>}
          <Button type="button" variant="gold" onClick={save} disabled={busy}>
            <Save className="h-4 w-4" /> {busy ? "Salvataggio…" : "Salva brand"}
          </Button>
        </div>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Anteprima</p>
          <div className="rounded-2xl border bg-background p-4 text-xs">
            <div className="flex items-center gap-3">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt="Logo"
                  className="h-9 w-9 rounded-md object-contain"
                />
              ) : (
                <span
                  className="grid h-9 w-9 place-items-center rounded-md font-display text-base"
                  style={{ background: `${accent}1a`, color: accent }}
                >
                  L
                </span>
              )}
              <div>
                <p className="font-medium">Locale</p>
                <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: accent }}>
                  Booking
                </p>
              </div>
            </div>
            <button
              type="button"
              className="mt-3 h-9 w-full rounded-md text-xs font-semibold"
              style={{ background: accent, color: "#15161a" }}
            >
              Conferma prenotazione
            </button>
            {footnote && (
              <p className="mt-3 text-center text-[10px] text-muted-foreground">{footnote}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
