"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Slot = { time: string; available: boolean };

const errorMessages: Record<string, string> = {
  slot_unavailable: "L'orario selezionato non è più disponibile, scegli un altro slot.",
  outside_service: "Quell'orario è fuori dai turni del locale.",
  invalid_datetime: "Data o ora non valide.",
  venue_not_found: "Locale non trovato.",
  invalid_input: "Controlla i dati inseriti.",
  invalid_json: "Invio non riuscito, riprova.",
};

export function WidgetForm({ slug, venueName }: { slug: string; venueName: string }) {
  const router = useRouter();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [step, setStep] = useState<1 | 2>(1);
  const [date, setDate] = useState(today);
  const [partySize, setPartySize] = useState(2);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [time, setTime] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingSlots(true);
    setTime(null);
    const url = `/api/widget/${slug}/slots?date=${date}&partySize=${partySize}`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setSlots(Array.isArray(data?.slots) ? data.slots : []);
      })
      .catch(() => {
        if (!cancelled) setSlots([]);
      })
      .finally(() => !cancelled && setLoadingSlots(false));
    return () => {
      cancelled = true;
    };
  }, [slug, date, partySize]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!time) return;
    setSubmitting(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      partySize,
      date,
      time,
      firstName: String(fd.get("firstName") ?? "").trim(),
      lastName: String(fd.get("lastName") ?? "").trim() || null,
      email: String(fd.get("email") ?? "").trim(),
      phone: String(fd.get("phone") ?? "").trim(),
      occasion: (fd.get("occasion") as string) || null,
      notes: String(fd.get("notes") ?? "").trim() || null,
      marketingOptIn: fd.get("marketingOptIn") === "on",
    };

    const res = await fetch(`/api/widget/${slug}`, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "content-type": "application/json" },
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(errorMessages[body?.error] ?? "Impossibile completare la prenotazione.");
      if (body?.error === "slot_unavailable") setStep(1);
      return;
    }
    const { reference } = await res.json();
    router.push(`/b/${slug}/done?ref=${reference}`);
  }

  const availableSlots = slots.filter((s) => s.available);

  return (
    <Card className="border-foreground/10">
      <CardContent className="p-6 md:p-8">
        {step === 1 ? (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="party">Persone</Label>
                <Select value={String(partySize)} onValueChange={(v) => setPartySize(Number(v))}>
                  <SelectTrigger id="party">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }).map((_, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>
                        {i + 1} {i === 0 ? "persona" : "persone"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="date">Data</Label>
                <Input
                  id="date"
                  type="date"
                  min={today}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Orario</Label>
              {loadingSlots ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> carico disponibilità…
                </div>
              ) : availableSlots.length === 0 ? (
                <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                  Nessun orario disponibile per il giorno selezionato.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {slots.map((s) => (
                    <button
                      key={s.time}
                      type="button"
                      disabled={!s.available}
                      onClick={() => {
                        setTime(s.time);
                        setStep(2);
                      }}
                      className={cn(
                        "rounded-md border px-2 py-2 text-sm transition",
                        s.available
                          ? "hover:border-gilt hover:bg-gilt/10"
                          : "cursor-not-allowed border-dashed text-muted-foreground/50",
                        time === s.time && "border-gilt bg-gilt/15",
                      )}
                    >
                      {s.time}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="rounded-md bg-secondary px-3 py-2 text-xs text-muted-foreground">
              Stai prenotando da <span className="font-medium text-foreground">{venueName}</span> il{" "}
              <span className="font-medium text-foreground">{date}</span> alle{" "}
              <span className="font-medium text-foreground">{time}</span> per{" "}
              <span className="font-medium text-foreground">{partySize}</span>.{" "}
              <button
                type="button"
                onClick={() => setStep(1)}
                className="ml-1 underline-offset-2 hover:underline"
              >
                Modifica
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">Nome</Label>
                <Input id="firstName" name="firstName" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">Cognome</Label>
                <Input id="lastName" name="lastName" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Telefono</Label>
                <Input id="phone" name="phone" required placeholder="+39 …" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="occasion">Occasione (opzionale)</Label>
              <Select name="occasion">
                <SelectTrigger id="occasion">
                  <SelectValue placeholder="Nessuna" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BIRTHDAY">Compleanno</SelectItem>
                  <SelectItem value="ANNIVERSARY">Anniversario</SelectItem>
                  <SelectItem value="BUSINESS">Lavoro</SelectItem>
                  <SelectItem value="DATE">Romantica</SelectItem>
                  <SelectItem value="CELEBRATION">Celebrazione</SelectItem>
                  <SelectItem value="OTHER">Altro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">Note (allergie, preferenze)</Label>
              <Textarea id="notes" name="notes" rows={3} />
            </div>

            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                name="marketingOptIn"
                className="mt-0.5 h-3.5 w-3.5 rounded border-input"
              />
              Voglio ricevere comunicazioni e proposte da {venueName}.
            </label>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setStep(1)}>
                Indietro
              </Button>
              <Button type="submit" variant="gold" disabled={submitting}>
                {submitting ? "Invio…" : "Conferma prenotazione"}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
