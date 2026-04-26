"use client";

import { useEffect, useState } from "react";
import { Calendar, Copy, RefreshCw } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CalendarFeedCard({
  baseUrl,
  venueSlug,
}: {
  baseUrl: string;
  venueSlug: string;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let aborted = false;
    (async () => {
      const res = await fetch("/api/cal/token");
      if (!res.ok || aborted) return;
      const j = (await res.json()) as { token: string };
      setToken(j.token);
    })();
    return () => {
      aborted = true;
    };
  }, []);

  async function rotate() {
    if (!confirm("Generare un nuovo token? Le sottoscrizioni esistenti smetteranno di funzionare."))
      return;
    setBusy(true);
    const res = await fetch("/api/cal/token", { method: "POST" });
    setBusy(false);
    if (!res.ok) return;
    const j = (await res.json()) as { token: string };
    setToken(j.token);
    setMessage("Token rigenerato. Aggiorna le sottoscrizioni nel tuo calendario.");
  }

  const url = token
    ? `${baseUrl.replace(/\/$/, "")}/api/cal/${venueSlug}/${token}.ics`
    : "Caricamento…";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-4 w-4" /> Feed calendario sala
        </CardTitle>
        <CardDescription>
          Sottoscrivi questo URL da Google Calendar / Outlook / Apple Calendar per vedere tutte
          le prenotazioni di sala in tempo reale.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2">
          <Input value={url} readOnly className="font-mono text-xs" />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              navigator.clipboard?.writeText(url);
              setMessage("URL copiato.");
            }}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={rotate} disabled={busy}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Coperti i 7 giorni passati e i 60 futuri. Cache lato cliente: 5 min. Per Google
          Calendar: <em>Altri calendari → Aggiungi tramite URL</em>.
        </p>
        {message && <p className="text-xs text-emerald-700">{message}</p>}
      </CardContent>
    </Card>
  );
}
