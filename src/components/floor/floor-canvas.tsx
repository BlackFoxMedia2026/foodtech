"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Table, TableShape } from "@prisma/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Save,
  Lock,
  RotateCw,
  Trash2,
  EyeOff,
  Eye,
  Shapes,
  Keyboard,
} from "lucide-react";

type Local = Table & { dirty?: boolean };

const GRID = 20;
const SHAPES: TableShape[] = ["ROUND", "SQUARE", "RECT", "BOOTH", "LOUNGE"];

const shapeSize: Record<TableShape, { w: number; h: number }> = {
  ROUND: { w: 80, h: 80 },
  SQUARE: { w: 80, h: 80 },
  RECT: { w: 120, h: 70 },
  BOOTH: { w: 160, h: 90 },
  LOUNGE: { w: 140, h: 100 },
};

function snap(n: number) {
  return Math.round(n / GRID) * GRID;
}

export function FloorCanvas({
  initialTables,
  width = 1200,
  height = 760,
}: {
  initialTables: Table[];
  width?: number;
  height?: number;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [tables, setTables] = useState<Local[]>(initialTables);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(true);

  const dirtyCount = useMemo(() => tables.filter((t) => t.dirty).length, [tables]);
  const selectedTables = useMemo(
    () => tables.filter((t) => selected.has(t.id)),
    [tables, selected],
  );

  const moveSelected = useCallback(
    (dx: number, dy: number) => {
      setTables((prev) =>
        prev.map((t) => {
          if (!selected.has(t.id)) return t;
          const size = shapeSize[t.shape];
          const nx = Math.max(0, Math.min(width - size.w, t.posX + dx));
          const ny = Math.max(0, Math.min(height - size.h, t.posY + dy));
          return { ...t, posX: nx, posY: ny, dirty: true };
        }),
      );
    },
    [selected, width, height],
  );

  const rotateSelected = useCallback(
    (deg = 15) => {
      setTables((prev) =>
        prev.map((t) =>
          selected.has(t.id)
            ? { ...t, rotation: ((t.rotation + deg) % 360 + 360) % 360, dirty: true }
            : t,
        ),
      );
    },
    [selected],
  );

  const cycleShape = useCallback(() => {
    setTables((prev) =>
      prev.map((t) => {
        if (!selected.has(t.id)) return t;
        const idx = SHAPES.indexOf(t.shape);
        const next = SHAPES[(idx + 1) % SHAPES.length];
        return { ...t, shape: next, dirty: true };
      }),
    );
  }, [selected]);

  const toggleActive = useCallback(() => {
    setTables((prev) =>
      prev.map((t) => (selected.has(t.id) ? { ...t, active: !t.active, dirty: true } : t)),
    );
  }, [selected]);

  const deleteSelected = useCallback(async () => {
    if (selected.size === 0) return;
    const ids = [...selected];
    if (!confirm(`Eliminare ${ids.length} tavolo${ids.length > 1 ? "i" : ""}? Le prenotazioni associate restano ma perdono l'assegnazione.`)) return;
    await Promise.all(ids.map((id) => fetch(`/api/tables/${id}`, { method: "DELETE" })));
    setTables((prev) => prev.filter((t) => !selected.has(t.id)));
    setSelected(new Set());
    router.refresh();
  }, [selected, router]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      const step = e.shiftKey ? GRID * 5 : GRID;
      switch (e.key) {
        case "ArrowLeft":
          if (selected.size) { e.preventDefault(); moveSelected(-step, 0); }
          break;
        case "ArrowRight":
          if (selected.size) { e.preventDefault(); moveSelected(step, 0); }
          break;
        case "ArrowUp":
          if (selected.size) { e.preventDefault(); moveSelected(0, -step); }
          break;
        case "ArrowDown":
          if (selected.size) { e.preventDefault(); moveSelected(0, step); }
          break;
        case "r":
        case "R":
          if (selected.size) { e.preventDefault(); rotateSelected(e.shiftKey ? -15 : 15); }
          break;
        case "Delete":
        case "Backspace":
          if (selected.size) { e.preventDefault(); void deleteSelected(); }
          break;
        case "Escape":
          setSelected(new Set());
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected.size, moveSelected, rotateSelected, deleteSelected]);

  function onTableMouseDown(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    const additive = e.shiftKey || e.metaKey || e.ctrlKey;
    if (additive) {
      setSelected((prev) => {
        const n = new Set(prev);
        if (n.has(id)) n.delete(id);
        else n.add(id);
        return n;
      });
    } else if (!selected.has(id)) {
      setSelected(new Set([id]));
    }

    const startX = e.clientX;
    const startY = e.clientY;
    const movingIds = new Set(selected.has(id) ? selected : new Set([id]));
    const baseline = new Map<string, { x: number; y: number }>();
    tables.forEach((t) => {
      if (movingIds.has(t.id)) baseline.set(t.id, { x: t.posX, y: t.posY });
    });

    let moved = false;
    function move(ev: MouseEvent) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
      setTables((prev) =>
        prev.map((p) => {
          const base = baseline.get(p.id);
          if (!base) return p;
          const size = shapeSize[p.shape];
          const rawX = base.x + dx;
          const rawY = base.y + dy;
          const nx = snapEnabled ? snap(rawX) : Math.round(rawX);
          const ny = snapEnabled ? snap(rawY) : Math.round(rawY);
          return {
            ...p,
            posX: Math.max(0, Math.min(width - size.w, nx)),
            posY: Math.max(0, Math.min(height - size.h, ny)),
            dirty: true,
          };
        }),
      );
    }
    function up() {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      if (!moved && !additive && selected.has(id) && selected.size > 1) {
        setSelected(new Set([id]));
      }
    }
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  function onCanvasMouseDown(e: React.MouseEvent) {
    if (e.target === e.currentTarget) setSelected(new Set());
  }

  async function persist() {
    const dirty = tables.filter((t) => t.dirty);
    if (dirty.length === 0) return;
    setSaving(true);
    await Promise.all(
      dirty.map((t) =>
        fetch(`/api/tables/${t.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            posX: t.posX,
            posY: t.posY,
            rotation: t.rotation,
            seats: t.seats,
            label: t.label,
            shape: t.shape,
            active: t.active,
          }),
        }),
      ),
    );
    setTables((prev) => prev.map((t) => ({ ...t, dirty: false })));
    setSaving(false);
    router.refresh();
  }

  async function addTable() {
    const label = prompt("Etichetta nuovo tavolo (es. T20)") ?? "";
    if (!label.trim()) return;
    const seats = Number(prompt("Posti", "2") ?? 2);
    const res = await fetch("/api/tables", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label: label.trim(), seats, posX: 80, posY: 80 }),
    });
    if (res.ok) {
      const t = await res.json();
      setTables((prev) => [...prev, t]);
      setSelected(new Set([t.id]));
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          <p>
            {selected.size === 0
              ? "Trascina i tavoli per riorganizzare. Shift-click per selezione multipla."
              : `${selected.size} tavolo${selected.size > 1 ? "i" : ""} selezionati · ${dirtyCount} modifiche da salvare`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={snapEnabled}
              onChange={(e) => setSnapEnabled(e.target.checked)}
              className="h-3.5 w-3.5"
            />
            Snap {GRID}px
          </label>
          <Button
            variant="subtle"
            size="sm"
            onClick={() => rotateSelected(15)}
            disabled={selected.size === 0}
          >
            <RotateCw className="h-4 w-4" /> Ruota
          </Button>
          <Button
            variant="subtle"
            size="sm"
            onClick={cycleShape}
            disabled={selected.size === 0}
          >
            <Shapes className="h-4 w-4" /> Forma
          </Button>
          <Button
            variant="subtle"
            size="sm"
            onClick={toggleActive}
            disabled={selected.size === 0}
          >
            {selectedTables.every((t) => t.active) ? (
              <>
                <EyeOff className="h-4 w-4" /> Disattiva
              </>
            ) : (
              <>
                <Eye className="h-4 w-4" /> Attiva
              </>
            )}
          </Button>
          <Button
            variant="subtle"
            size="sm"
            onClick={deleteSelected}
            disabled={selected.size === 0}
          >
            <Trash2 className="h-4 w-4" /> Elimina
          </Button>
          <span className="hidden h-5 w-px bg-border md:inline-block" />
          <Button variant="subtle" size="sm" onClick={addTable}>
            <Plus className="h-4 w-4" /> Nuovo
          </Button>
          <Button variant="gold" size="sm" onClick={persist} disabled={saving || dirtyCount === 0}>
            <Save className="h-4 w-4" />
            {saving ? "Salvataggio…" : dirtyCount > 0 ? `Salva (${dirtyCount})` : "Salva sala"}
          </Button>
        </div>
      </div>

      <div
        ref={ref}
        onMouseDown={onCanvasMouseDown}
        className="relative overflow-hidden rounded-xl border-2 border-dashed border-border bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.06)_1px,transparent_0)] [background-size:20px_20px]"
        style={{ height }}
      >
        {tables.map((t) => {
          const isSelected = selected.has(t.id);
          const size = shapeSize[t.shape];
          return (
            <button
              key={t.id}
              type="button"
              onMouseDown={(e) => onTableMouseDown(t.id, e)}
              className={cn(
                "absolute grid place-items-center select-none transition-shadow shadow-md hover:shadow-lg cursor-grab active:cursor-grabbing",
                t.shape === "ROUND" && "rounded-full",
                t.shape === "SQUARE" && "rounded-md",
                t.shape === "RECT" && "rounded-md",
                t.shape === "BOOTH" && "rounded-2xl",
                t.shape === "LOUNGE" && "rounded-3xl",
                t.active ? "bg-carbon-800 text-sand-50" : "bg-muted text-muted-foreground",
                isSelected && "ring-4 ring-gilt/70 shadow-xl",
              )}
              style={{
                left: t.posX,
                top: t.posY,
                width: size.w,
                height: size.h,
                transform: `rotate(${t.rotation}deg)`,
              }}
            >
              <span className="text-display text-sm font-semibold">{t.label}</span>
              <span className="text-[10px] opacity-70">{t.seats} posti</span>
              {!t.active && <Lock className="absolute right-1 top-1 h-3 w-3" />}
            </button>
          );
        })}
      </div>

      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer inline-flex items-center gap-1.5">
          <Keyboard className="h-3.5 w-3.5" /> Scorciatoie
        </summary>
        <div className="mt-2 grid gap-1 sm:grid-cols-2">
          <Shortcut k="Click" v="seleziona tavolo" />
          <Shortcut k="Shift + Click" v="aggiungi/togli dalla selezione" />
          <Shortcut k="Trascina" v="muovi (con snap se attivo)" />
          <Shortcut k="Frecce" v="muovi di 20px" />
          <Shortcut k="Shift + Frecce" v="muovi di 100px" />
          <Shortcut k="R / Shift+R" v="ruota di 15° (avanti/indietro)" />
          <Shortcut k="Delete" v="elimina selezionati" />
          <Shortcut k="Esc" v="deseleziona" />
        </div>
      </details>
    </div>
  );
}

function Shortcut({ k, v }: { k: string; v: string }) {
  return (
    <p>
      <kbd className="rounded border bg-secondary px-1.5 py-0.5 text-[10px] font-medium">{k}</kbd>{" "}
      {v}
    </p>
  );
}
