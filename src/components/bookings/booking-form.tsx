"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type TableOpt = {
  id: string;
  label: string;
  seats: number;
  combinable?: boolean;
};

const COMBINE_THRESHOLD = 6;

export function BookingForm({
  tables,
  onClose,
}: {
  tables: TableOpt[];
  onClose?: () => void;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partySize, setPartySize] = useState(2);
  const [primaryTableId, setPrimaryTableId] = useState<string>("");
  const [combinedIds, setCombinedIds] = useState<string[]>([]);

  const combinableTables = useMemo(
    () => tables.filter((t) => t.combinable !== false),
    [tables],
  );

  const showCombine = partySize >= COMBINE_THRESHOLD;

  // Quando l'utente cambia primario, rimuoviamo dal combined per evitare duplicati.
  function onPrimaryChange(v: string) {
    setPrimaryTableId(v);
    setCombinedIds((prev) => prev.filter((id) => id !== v));
  }

  function toggleCombined(id: string) {
    if (id === primaryTableId) return;
    setCombinedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  const selectedSeats = useMemo(() => {
    const ids = [primaryTableId, ...combinedIds].filter(Boolean);
    return ids.reduce((sum, id) => {
      const t = tables.find((x) => x.id === id);
      return sum + (t?.seats ?? 0);
    }, 0);
  }, [primaryTableId, combinedIds, tables]);

  const suggestion = useMemo(() => {
    if (!showCombine) return null;
    const t6 = combinableTables.filter((t) => t.seats >= 6).length;
    const t8 = combinableTables.filter((t) => t.seats >= 8).length;
    if (partySize >= 16 && t6 >= 3) {
      return `Per ${partySize} persone considera 3 tavoli da 6 o 2 da 8 + 1 da 4.`;
    }
    if (partySize >= 10 && t6 >= 2) {
      return `Per ${partySize} persone bastano 2 tavoli da ${Math.ceil(partySize / 2)} posti.`;
    }
    if (t8 > 0) {
      return `Per ${partySize} persone valuta 1 tavolo da 8 + 1 da ${partySize - 8 > 0 ? partySize - 8 : 4}.`;
    }
    return `Per ${partySize} persone combina più tavoli sotto.`;
  }, [showCombine, partySize, combinableTables]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const date = fd.get("date") as string;
    const time = fd.get("time") as string;

    // Se non serve combinare (party < soglia o nessun secondario), invia [].
    const combinedToSend = showCombine ? combinedIds : [];

    const payload = {
      guest: {
        firstName: fd.get("firstName"),
        lastName: fd.get("lastName"),
        email: fd.get("email"),
        phone: fd.get("phone"),
      },
      partySize: Number(fd.get("partySize")),
      startsAt: new Date(`${date}T${time}`).toISOString(),
      durationMin: Number(fd.get("durationMin") || 105),
      tableId: primaryTableId || null,
      combinedTableIds: combinedToSend,
      source: fd.get("source"),
      occasion: fd.get("occasion") || null,
      notes: fd.get("notes") || null,
    };

    const res = await fetch("/api/bookings", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "content-type": "application/json" },
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const msg: string | undefined = body?.error;
      if (msg?.startsWith("table_overlap_")) {
        setError(
          "Un tavolo selezionato è già occupato in questa fascia. Scegline un altro.",
        );
      } else if (msg?.startsWith("table_not_combinable_")) {
        setError("Uno dei tavoli selezionati non è combinabile.");
      } else if (msg === "combined_requires_primary_table") {
        setError("Seleziona prima un tavolo primario.");
      } else {
        setError("Impossibile salvare. Verifica i dati.");
      }
      return;
    }
    router.refresh();
    onClose?.();
  }

  const today = new Date().toISOString().slice(0, 10);
  const seatsOk = !showCombine || selectedSeats >= partySize;

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="firstName">Nome</Label>
          <Input id="firstName" name="firstName" required placeholder="Lorenzo" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lastName">Cognome</Label>
          <Input id="lastName" name="lastName" placeholder="Ferri" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" placeholder="ospite@email.com" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Telefono</Label>
          <Input id="phone" name="phone" placeholder="+39 …" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="date">Data</Label>
          <Input id="date" name="date" type="date" defaultValue={today} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="time">Ora</Label>
          <Input id="time" name="time" type="time" defaultValue="20:00" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="partySize">Persone</Label>
          <Input
            id="partySize"
            name="partySize"
            type="number"
            min={1}
            max={50}
            value={partySize}
            onChange={(e) => setPartySize(Math.max(1, Number(e.target.value) || 1))}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Tavolo {showCombine ? "(primario)" : ""}</Label>
          <Select value={primaryTableId} onValueChange={onPrimaryChange}>
            <SelectTrigger>
              <SelectValue placeholder="Assegna in seguito" />
            </SelectTrigger>
            <SelectContent>
              {tables.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.label} · {t.seats} posti
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="durationMin">Durata (min)</Label>
          <Input id="durationMin" name="durationMin" type="number" min={15} max={480} defaultValue={105} />
        </div>
      </div>

      {showCombine && (
        <div className="space-y-2 rounded-xl border border-gilt/30 bg-gilt/5 p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-gilt-light">
                Combina tavoli per gruppo grande
              </p>
              {suggestion && (
                <p className="mt-0.5 text-[12px] text-secondary">{suggestion}</p>
              )}
            </div>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-medium text-numeric",
                seatsOk
                  ? "bg-status-confirmed-soft text-status-confirmed"
                  : "bg-status-no-show-soft text-status-no-show",
              )}
            >
              {selectedSeats}/{partySize} posti
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5 pt-1">
            {combinableTables
              .filter((t) => t.id !== primaryTableId)
              .map((t) => {
                const active = combinedIds.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleCombined(t.id)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors",
                      active
                        ? "border-gilt bg-gilt/20 text-gilt-light"
                        : "border-border bg-card text-secondary hover:text-foreground",
                    )}
                  >
                    {t.label} · {t.seats}p
                  </button>
                );
              })}
            {combinableTables.length === 0 && (
              <p className="text-xs text-tertiary">
                Nessun tavolo combinabile disponibile. Abilita `combinable` sui
                tavoli in editor.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Fonte</Label>
          <Select name="source" defaultValue="PHONE">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="PHONE">Telefono</SelectItem>
              <SelectItem value="WIDGET">Sito</SelectItem>
              <SelectItem value="WALK_IN">Walk-in</SelectItem>
              <SelectItem value="GOOGLE">Google</SelectItem>
              <SelectItem value="SOCIAL">Social</SelectItem>
              <SelectItem value="CONCIERGE">Concierge</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Occasione</Label>
          <Select name="occasion">
            <SelectTrigger><SelectValue placeholder="Nessuna" /></SelectTrigger>
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
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Note</Label>
        <Textarea id="notes" name="notes" placeholder="Allergie, preferenze, richieste speciali…" />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-2">
        {onClose && (
          <Button type="button" variant="outline" onClick={onClose}>
            Annulla
          </Button>
        )}
        <Button type="submit" variant="gold" disabled={submitting}>
          {submitting ? "Salvataggio…" : "Crea prenotazione"}
        </Button>
      </div>
    </form>
  );
}
