"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Shift = {
  id: string;
  name: string;
  weekday: number;
  startMinute: number;
  endMinute: number;
  capacity: number;
  slotMinutes: number;
  active: boolean;
};

const WEEKDAYS = [
  { v: 1, label: "Lun" },
  { v: 2, label: "Mar" },
  { v: 3, label: "Mer" },
  { v: 4, label: "Gio" },
  { v: 5, label: "Ven" },
  { v: 6, label: "Sab" },
  { v: 0, label: "Dom" },
];

function mmToHHMM(m: number) {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function hhmmToMin(s: string) {
  const [h, m] = s.split(":").map((x) => Number(x) || 0);
  return h * 60 + m;
}

export function ShiftsEditor({ initial }: { initial: Shift[] }) {
  const router = useRouter();
  const [shifts, setShifts] = useState<Shift[]>(initial);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [weekday, setWeekday] = useState<number>(1);
  const [busy, setBusy] = useState(false);

  const grouped = useMemo(() => {
    const m = new Map<number, Shift[]>();
    for (const s of shifts) {
      if (!m.has(s.weekday)) m.set(s.weekday, []);
      m.get(s.weekday)!.push(s);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.startMinute - b.startMinute);
    return m;
  }, [shifts]);

  async function persist(method: "POST" | "PATCH" | "DELETE", id: string | null, body?: unknown) {
    setBusy(true);
    try {
      const url = id ? `/api/shifts/${id}` : "/api/shifts";
      const res = await fetch(url, {
        method,
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) throw new Error("save_failed");
      if (method === "DELETE") {
        setShifts((prev) => prev.filter((s) => s.id !== id));
      } else {
        const updated = (await res.json()) as Shift;
        setShifts((prev) => {
          const without = prev.filter((s) => s.id !== updated.id);
          return [...without, updated];
        });
      }
      router.refresh();
    } finally {
      setBusy(false);
      setEditingId(null);
    }
  }

  function onCopyToWeekend(source: Shift) {
    if (!confirm(`Copiare "${source.name}" del ${WEEKDAYS.find((w) => w.v === source.weekday)?.label} su Sab e Dom?`)) return;
    void Promise.all(
      [6, 0]
        .filter((wd) => wd !== source.weekday)
        .map((wd) =>
          persist("POST", null, {
            name: source.name,
            weekday: wd,
            startMinute: source.startMinute,
            endMinute: source.endMinute,
            capacity: source.capacity,
            slotMinutes: source.slotMinutes,
            active: source.active,
          }),
        ),
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap items-center gap-1 rounded-md border bg-background p-1">
          {WEEKDAYS.map((w) => (
            <button
              key={w.v}
              type="button"
              onClick={() => setWeekday(w.v)}
              className={cn(
                "rounded-sm px-3 py-1 text-xs",
                weekday === w.v ? "bg-carbon-800 text-sand-50" : "text-muted-foreground hover:bg-secondary",
              )}
            >
              {w.label}{" "}
              <span className="ml-1 text-[10px] opacity-60">{(grouped.get(w.v) ?? []).length}</span>
            </button>
          ))}
        </div>
        <Button
          variant="gold"
          size="sm"
          onClick={() => setEditingId("new")}
          disabled={editingId !== null}
        >
          <Plus className="h-4 w-4" /> Aggiungi turno
        </Button>
      </div>

      <div className="space-y-2">
        {(grouped.get(weekday) ?? []).length === 0 && editingId !== "new" && (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nessun turno per {WEEKDAYS.find((w) => w.v === weekday)?.label}.
          </p>
        )}

        {(grouped.get(weekday) ?? []).map((s) =>
          editingId === s.id ? (
            <ShiftForm
              key={s.id}
              busy={busy}
              initial={s}
              onSubmit={(payload) => persist("PATCH", s.id, payload)}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <div
              key={s.id}
              className={cn(
                "flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm",
                !s.active && "opacity-60",
              )}
            >
              <div className="flex items-center gap-3">
                <span className="font-medium">{s.name}</span>
                <Badge tone="neutral">
                  {mmToHHMM(s.startMinute)} – {mmToHHMM(s.endMinute)}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Capienza {s.capacity} · slot {s.slotMinutes}m
                </span>
                {!s.active && <Badge tone="warning">Disattivato</Badge>}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onCopyToWeekend(s)}
                  disabled={busy}
                >
                  Copia in weekend
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => persist("PATCH", s.id, { active: !s.active })}
                  disabled={busy}
                >
                  {s.active ? "Disattiva" : "Attiva"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setEditingId(s.id)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (confirm(`Eliminare il turno "${s.name}"?`)) void persist("DELETE", s.id);
                  }}
                  disabled={busy}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ),
        )}

        {editingId === "new" && (
          <ShiftForm
            busy={busy}
            initial={{
              id: "",
              name: "",
              weekday,
              startMinute: 19 * 60,
              endMinute: 23 * 60,
              capacity: 60,
              slotMinutes: 15,
              active: true,
            }}
            onSubmit={(payload) => persist("POST", null, payload)}
            onCancel={() => setEditingId(null)}
          />
        )}
      </div>
    </div>
  );
}

function ShiftForm({
  initial,
  busy,
  onSubmit,
  onCancel,
}: {
  initial: Shift;
  busy: boolean;
  onSubmit: (payload: Partial<Shift>) => void;
  onCancel: () => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        onSubmit({
          name: String(fd.get("name") ?? "").trim(),
          weekday: Number(fd.get("weekday")),
          startMinute: hhmmToMin(String(fd.get("start") ?? "19:00")),
          endMinute: hhmmToMin(String(fd.get("end") ?? "23:00")),
          capacity: Number(fd.get("capacity") ?? 60),
          slotMinutes: Number(fd.get("slotMinutes") ?? 15),
        });
      }}
      className="grid gap-3 rounded-md border bg-secondary/50 p-4 sm:grid-cols-6"
    >
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="sh-name">Nome</Label>
        <Input id="sh-name" name="name" defaultValue={initial.name} required placeholder="Pranzo, Cena, Aperitivo…" />
      </div>
      <div className="space-y-1.5">
        <Label>Giorno</Label>
        <Select name="weekday" defaultValue={String(initial.weekday)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WEEKDAYS.map((w) => (
              <SelectItem key={w.v} value={String(w.v)}>
                {w.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sh-start">Inizio</Label>
        <Input id="sh-start" name="start" type="time" defaultValue={mmToHHMM(initial.startMinute)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sh-end">Fine</Label>
        <Input id="sh-end" name="end" type="time" defaultValue={mmToHHMM(initial.endMinute)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sh-cap">Capienza</Label>
        <Input id="sh-cap" name="capacity" type="number" min={1} max={2000} defaultValue={initial.capacity} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sh-slot">Slot (min)</Label>
        <Input id="sh-slot" name="slotMinutes" type="number" min={5} max={120} step={5} defaultValue={initial.slotMinutes} required />
      </div>
      <div className="flex items-end justify-end gap-2 sm:col-span-6">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
          <X className="h-3.5 w-3.5" /> Annulla
        </Button>
        <Button type="submit" variant="gold" size="sm" disabled={busy}>
          <Save className="h-3.5 w-3.5" /> {initial.id ? "Salva" : "Crea"}
        </Button>
      </div>
    </form>
  );
}
