"use client";

import { useState } from "react";
import { Globe2, Save } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const CURRENCIES = [
  { code: "EUR", label: "Euro (EUR)" },
  { code: "USD", label: "US Dollar (USD)" },
  { code: "GBP", label: "British Pound (GBP)" },
  { code: "CHF", label: "Swiss Franc (CHF)" },
  { code: "SEK", label: "Swedish Krona (SEK)" },
  { code: "NOK", label: "Norwegian Krone (NOK)" },
  { code: "JPY", label: "Japanese Yen (JPY)" },
  { code: "AUD", label: "Australian Dollar (AUD)" },
];

export function ReportingCurrencyCard({
  initial,
  canEdit,
}: {
  initial: string;
  canEdit: boolean;
}) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/org/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ baseCurrency: value }),
    });
    setBusy(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(
        b?.error === "forbidden"
          ? "Solo i Manager possono cambiare la valuta di reporting."
          : "Salvataggio non riuscito.",
      );
      return;
    }
    setMessage(
      "Valuta aggiornata. Il portfolio mostrerà i nuovi totali al prossimo refresh.",
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe2 className="h-4 w-4" /> Valuta di reporting
        </CardTitle>
        <CardDescription>
          Tutte le aggregazioni cross-venue (Portfolio, ricavi totali) vengono convertite
          in questa valuta. Ogni locale resta nella propria valuta nativa.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5 max-w-xs">
          <Label htmlFor="base-currency">Valuta di reporting</Label>
          <select
            id="base-currency"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={!canEdit || busy}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {message && <p className="text-sm text-emerald-700">{message}</p>}
        {canEdit ? (
          <Button
            type="button"
            variant="gold"
            onClick={save}
            disabled={busy || value === initial}
          >
            <Save className="h-4 w-4" /> {busy ? "Salvataggio…" : "Salva"}
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">
            Solo i Manager dell&apos;organizzazione possono modificare questa
            impostazione.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
