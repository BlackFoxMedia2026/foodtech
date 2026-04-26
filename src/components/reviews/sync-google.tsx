"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, RefreshCw, Save } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SyncGoogleCard({
  initialPlaceId,
  apiEnabled,
}: {
  initialPlaceId: string | null;
  apiEnabled: boolean;
}) {
  const router = useRouter();
  const [placeId, setPlaceId] = useState(initialPlaceId ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function savePlace() {
    setBusy("save");
    setError(null);
    setMessage(null);
    const res = await fetch("/api/reviews/place", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ googlePlaceId: placeId.trim() || null }),
    });
    setBusy(null);
    if (!res.ok) {
      setError("Salvataggio non riuscito.");
      return;
    }
    setMessage("Place ID salvato.");
    router.refresh();
  }

  async function sync() {
    setBusy("sync");
    setError(null);
    setMessage(null);
    const res = await fetch("/api/reviews/sync", { method: "POST" });
    setBusy(null);
    const data = await res.json().catch(() => ({}));
    if (!data.ok) {
      const reason = data.reason ?? "errore";
      setError(
        reason === "no_api_key"
          ? "GOOGLE_PLACES_API_KEY non configurata sul server."
          : reason === "no_place_id"
            ? "Imposta prima il Place ID."
            : `Sincronizzazione fallita: ${reason}.`,
      );
      return;
    }
    setMessage(
      `Sincronizzato. ${data.fetched} recensioni dall'API, ${data.inserted} salvate.${
        data.googleRating ? ` Rating Google: ${data.googleRating}/5 (${data.googleTotalRatings} totali).` : ""
      }`,
    );
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-4 w-4" /> Sincronizza Google
        </CardTitle>
        <CardDescription>
          Inserisci il <code>place_id</code> della scheda Google del locale. La sync importa le
          recensioni più recenti (max 5 per chiamata, ordinate per data).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!apiEnabled && (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Google Places API non configurata. Aggiungi <code>GOOGLE_PLACES_API_KEY</code> nelle
            env per attivare la sync reale.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={placeId}
            onChange={(e) => setPlaceId(e.target.value)}
            placeholder="Es. ChIJN1t_tDeuEmsRUsoyG83frY4"
            className="flex-1 font-mono text-xs"
            maxLength={120}
          />
          <Button type="button" variant="outline" size="sm" onClick={savePlace} disabled={busy !== null}>
            <Save className="h-3.5 w-3.5" /> Salva
          </Button>
          <Button
            type="button"
            variant="gold"
            size="sm"
            onClick={sync}
            disabled={busy !== null || !placeId.trim()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {busy === "sync" ? "Sync…" : "Sincronizza"}
          </Button>
        </div>
        {message && <p className="text-xs text-emerald-700">{message}</p>}
        {error && <p className="text-xs text-destructive">{error}</p>}
        <p className="text-[11px] text-muted-foreground">
          Trovi il <code>place_id</code> da{" "}
          <a
            href="https://developers.google.com/maps/documentation/places/web-service/place-id"
            target="_blank"
            rel="noopener"
            className="underline"
          >
            Place ID Finder di Google
          </a>
          .
        </p>
      </CardContent>
    </Card>
  );
}
