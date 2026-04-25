"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Table, TableShape, FloorDecor, DecorKind } from "@prisma/client";
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
  Sprout,
  Sofa,
  Wine,
  ChefHat,
  Disc3,
  Mic,
  Columns2,
  Minus,
  DoorOpen,
  AppWindow,
  LogIn,
  Bath,
  Waves,
  ArrowUpDown,
  Lamp,
  Type,
  Armchair,
  Square,
  ChevronDown,
} from "lucide-react";

const GRID = 20;
const SHAPES: TableShape[] = ["ROUND", "SQUARE", "RECT", "BOOTH", "LOUNGE"];

const tableShapeSize: Record<TableShape, { w: number; h: number }> = {
  ROUND: { w: 80, h: 80 },
  SQUARE: { w: 80, h: 80 },
  RECT: { w: 120, h: 70 },
  BOOTH: { w: 160, h: 90 },
  LOUNGE: { w: 140, h: 100 },
};

const decorDefaultSize: Record<DecorKind, { w: number; h: number }> = {
  PLANT: { w: 60, h: 60 },
  SOFA: { w: 180, h: 80 },
  ARMCHAIR: { w: 80, h: 80 },
  BAR: { w: 240, h: 60 },
  COUNTER: { w: 200, h: 60 },
  KITCHEN: { w: 240, h: 120 },
  DJ_BOOTH: { w: 120, h: 80 },
  STAGE: { w: 240, h: 120 },
  COLUMN: { w: 40, h: 40 },
  DIVIDER: { w: 200, h: 20 },
  DOOR: { w: 60, h: 14 },
  WINDOW: { w: 100, h: 14 },
  ENTRANCE: { w: 120, h: 40 },
  RESTROOM: { w: 100, h: 100 },
  POOL: { w: 300, h: 180 },
  STAIRS: { w: 80, h: 120 },
  RUG: { w: 200, h: 140 },
  LAMP: { w: 32, h: 32 },
  LABEL: { w: 120, h: 32 },
};

const decorMeta: Record<DecorKind, { label: string; icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  PLANT:    { label: "Pianta",      icon: Sprout,     tone: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  SOFA:     { label: "Divano",      icon: Sofa,       tone: "bg-sand-200 text-carbon-800 border-sand-300" },
  ARMCHAIR: { label: "Poltrona",    icon: Armchair,   tone: "bg-sand-200 text-carbon-800 border-sand-300" },
  BAR:      { label: "Bancone bar", icon: Wine,       tone: "bg-carbon-700 text-sand-50 border-carbon-800" },
  COUNTER:  { label: "Bancone",     icon: Square,     tone: "bg-carbon-700 text-sand-50 border-carbon-800" },
  KITCHEN:  { label: "Cucina",      icon: ChefHat,    tone: "bg-rose-100 text-rose-700 border-rose-200" },
  DJ_BOOTH: { label: "Console DJ",  icon: Disc3,      tone: "bg-violet-100 text-violet-700 border-violet-200" },
  STAGE:    { label: "Palco",       icon: Mic,        tone: "bg-amber-100 text-amber-800 border-amber-200" },
  COLUMN:   { label: "Colonna",     icon: Columns2,   tone: "bg-stone-200 text-stone-700 border-stone-300" },
  DIVIDER:  { label: "Divisorio",   icon: Minus,      tone: "bg-stone-200 text-stone-700 border-stone-300" },
  DOOR:     { label: "Porta",       icon: DoorOpen,   tone: "bg-stone-200 text-stone-700 border-stone-300" },
  WINDOW:   { label: "Finestra",    icon: AppWindow,  tone: "bg-sky-100 text-sky-700 border-sky-200" },
  ENTRANCE: { label: "Ingresso",    icon: LogIn,      tone: "bg-gilt/15 text-gilt-dark border-gilt/40" },
  RESTROOM: { label: "Bagno",       icon: Bath,       tone: "bg-stone-200 text-stone-700 border-stone-300" },
  POOL:     { label: "Piscina",     icon: Waves,      tone: "bg-sky-100 text-sky-700 border-sky-200" },
  STAIRS:   { label: "Scale",       icon: ArrowUpDown,tone: "bg-stone-200 text-stone-700 border-stone-300" },
  RUG:      { label: "Tappeto",     icon: Square,     tone: "bg-amber-50 text-amber-800 border-amber-200" },
  LAMP:     { label: "Lampada",     icon: Lamp,       tone: "bg-amber-100 text-amber-800 border-amber-200" },
  LABEL:    { label: "Etichetta",   icon: Type,       tone: "bg-secondary text-foreground border-border" },
};

const PALETTE_KINDS: DecorKind[] = [
  "PLANT", "SOFA", "ARMCHAIR", "BAR", "COUNTER", "KITCHEN",
  "DJ_BOOTH", "STAGE", "POOL", "RUG", "COLUMN", "DIVIDER",
  "DOOR", "WINDOW", "ENTRANCE", "RESTROOM", "STAIRS", "LAMP", "LABEL",
];

type LocalTable = Table & { _dirty?: boolean };
type LocalDecor = FloorDecor & { _dirty?: boolean };

type ItemKey = `t:${string}` | `d:${string}`;

function tableSize(t: Pick<Table, "shape" | "width" | "height">) {
  const def = tableShapeSize[t.shape];
  return { w: t.width ?? def.w, h: t.height ?? def.h };
}

function snap(n: number) {
  return Math.round(n / GRID) * GRID;
}

export function FloorCanvas({
  initialTables,
  initialDecor,
  width = 1200,
  height = 760,
}: {
  initialTables: Table[];
  initialDecor: FloorDecor[];
  width?: number;
  height?: number;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [tables, setTables] = useState<LocalTable[]>(initialTables);
  const [decor, setDecor] = useState<LocalDecor[]>(initialDecor);
  const [selected, setSelected] = useState<Set<ItemKey>>(new Set());
  const [saving, setSaving] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const dirtyCount = useMemo(
    () => tables.filter((t) => t._dirty).length + decor.filter((d) => d._dirty).length,
    [tables, decor],
  );

  const itemSize = useCallback(
    (key: ItemKey): { w: number; h: number } => {
      if (key.startsWith("t:")) {
        const id = key.slice(2);
        const t = tables.find((x) => x.id === id);
        if (!t) return { w: 80, h: 80 };
        return tableSize(t);
      }
      const id = key.slice(2);
      const d = decor.find((x) => x.id === id);
      if (!d) return { w: 80, h: 80 };
      return { w: d.width, h: d.height };
    },
    [tables, decor],
  );

  const updateTable = useCallback(
    (id: string, patch: Partial<LocalTable>) => {
      setTables((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...patch, _dirty: true } : t)),
      );
    },
    [],
  );

  const updateDecor = useCallback(
    (id: string, patch: Partial<LocalDecor>) => {
      setDecor((prev) =>
        prev.map((d) => (d.id === id ? { ...d, ...patch, _dirty: true } : d)),
      );
    },
    [],
  );

  const moveSelected = useCallback(
    (dx: number, dy: number) => {
      selected.forEach((key) => {
        if (key.startsWith("t:")) {
          const id = key.slice(2);
          const t = tables.find((x) => x.id === id);
          if (!t) return;
          const sz = tableSize(t);
          const nx = Math.max(0, Math.min(width - sz.w, t.posX + dx));
          const ny = Math.max(0, Math.min(height - sz.h, t.posY + dy));
          updateTable(id, { posX: nx, posY: ny });
        } else {
          const id = key.slice(2);
          const d = decor.find((x) => x.id === id);
          if (!d) return;
          const nx = Math.max(0, Math.min(width - d.width, d.posX + dx));
          const ny = Math.max(0, Math.min(height - d.height, d.posY + dy));
          updateDecor(id, { posX: nx, posY: ny });
        }
      });
    },
    [selected, tables, decor, width, height, updateTable, updateDecor],
  );

  const rotateSelected = useCallback(
    (deg = 15) => {
      selected.forEach((key) => {
        const id = key.slice(2);
        if (key.startsWith("t:")) {
          const t = tables.find((x) => x.id === id);
          if (!t) return;
          updateTable(id, { rotation: (((t.rotation + deg) % 360) + 360) % 360 });
        } else {
          const d = decor.find((x) => x.id === id);
          if (!d) return;
          updateDecor(id, { rotation: (((d.rotation + deg) % 360) + 360) % 360 });
        }
      });
    },
    [selected, tables, decor, updateTable, updateDecor],
  );

  const cycleShape = useCallback(() => {
    selected.forEach((key) => {
      if (!key.startsWith("t:")) return;
      const id = key.slice(2);
      const t = tables.find((x) => x.id === id);
      if (!t) return;
      const idx = SHAPES.indexOf(t.shape);
      const next = SHAPES[(idx + 1) % SHAPES.length];
      updateTable(id, { shape: next, width: null, height: null });
    });
  }, [selected, tables, updateTable]);

  const toggleActive = useCallback(() => {
    selected.forEach((key) => {
      if (!key.startsWith("t:")) return;
      const id = key.slice(2);
      const t = tables.find((x) => x.id === id);
      if (!t) return;
      updateTable(id, { active: !t.active });
    });
  }, [selected, tables, updateTable]);

  const deleteSelected = useCallback(async () => {
    if (selected.size === 0) return;
    if (!confirm(`Eliminare ${selected.size} elemento${selected.size > 1 ? "i" : ""}? Le prenotazioni associate ai tavoli restano ma perdono l'assegnazione.`)) return;
    const tableIds: string[] = [];
    const decorIds: string[] = [];
    selected.forEach((k) => {
      if (k.startsWith("t:")) tableIds.push(k.slice(2));
      else decorIds.push(k.slice(2));
    });
    await Promise.all([
      ...tableIds.map((id) => fetch(`/api/tables/${id}`, { method: "DELETE" })),
      ...decorIds.map((id) => fetch(`/api/decor/${id}`, { method: "DELETE" })),
    ]);
    setTables((prev) => prev.filter((t) => !tableIds.includes(t.id)));
    setDecor((prev) => prev.filter((d) => !decorIds.includes(d.id)));
    setSelected(new Set());
    router.refresh();
  }, [selected, router]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
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

  function onItemMouseDown(key: ItemKey, e: React.MouseEvent) {
    e.stopPropagation();
    const additive = e.shiftKey || e.metaKey || e.ctrlKey;

    let next = selected;
    if (additive) {
      next = new Set(selected);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      setSelected(next);
    } else if (!selected.has(key)) {
      next = new Set([key]);
      setSelected(next);
    }

    const startX = e.clientX;
    const startY = e.clientY;
    const movingKeys = new Set(next.has(key) ? next : new Set([key]));
    const baseline = new Map<ItemKey, { x: number; y: number }>();
    movingKeys.forEach((k) => {
      if (k.startsWith("t:")) {
        const id = k.slice(2);
        const t = tables.find((x) => x.id === id);
        if (t) baseline.set(k, { x: t.posX, y: t.posY });
      } else {
        const id = k.slice(2);
        const d = decor.find((x) => x.id === id);
        if (d) baseline.set(k, { x: d.posX, y: d.posY });
      }
    });

    let moved = false;
    function move(ev: MouseEvent) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
      baseline.forEach((base, k) => {
        const sz = (() => {
          if (k.startsWith("t:")) {
            const t = tables.find((x) => x.id === k.slice(2));
            return t ? tableSize(t) : { w: 80, h: 80 };
          }
          const d = decor.find((x) => x.id === k.slice(2));
          return d ? { w: d.width, h: d.height } : { w: 80, h: 80 };
        })();
        const rawX = base.x + dx;
        const rawY = base.y + dy;
        const nx = Math.max(0, Math.min(width - sz.w, snapEnabled ? snap(rawX) : Math.round(rawX)));
        const ny = Math.max(0, Math.min(height - sz.h, snapEnabled ? snap(rawY) : Math.round(rawY)));
        if (k.startsWith("t:")) updateTable(k.slice(2), { posX: nx, posY: ny });
        else updateDecor(k.slice(2), { posX: nx, posY: ny });
      });
    }
    function up() {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      if (!moved && !additive && selected.has(key) && selected.size > 1) {
        setSelected(new Set([key]));
      }
    }
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  function onResizeMouseDown(key: ItemKey, e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const start = itemSize(key);
    const minW = key.startsWith("t:") ? 60 : 24;
    const minH = key.startsWith("t:") ? 60 : 24;
    function move(ev: MouseEvent) {
      const dw = ev.clientX - startX;
      const dh = ev.clientY - startY;
      const rawW = start.w + dw;
      const rawH = start.h + dh;
      const nw = Math.max(minW, snapEnabled ? snap(rawW) : Math.round(rawW));
      const nh = Math.max(minH, snapEnabled ? snap(rawH) : Math.round(rawH));
      if (key.startsWith("t:")) updateTable(key.slice(2), { width: nw, height: nh });
      else updateDecor(key.slice(2), { width: nw, height: nh });
    }
    function up() {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    }
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  function onCanvasMouseDown(e: React.MouseEvent) {
    if (e.target === e.currentTarget) setSelected(new Set());
  }

  async function persist() {
    const dirtyT = tables.filter((t) => t._dirty);
    const dirtyD = decor.filter((d) => d._dirty);
    if (dirtyT.length === 0 && dirtyD.length === 0) return;
    setSaving(true);
    await Promise.all([
      ...dirtyT.map((t) =>
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
            width: t.width,
            height: t.height,
          }),
        }),
      ),
      ...dirtyD.map((d) =>
        fetch(`/api/decor/${d.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            posX: d.posX,
            posY: d.posY,
            rotation: d.rotation,
            width: d.width,
            height: d.height,
            label: d.label,
            color: d.color,
          }),
        }),
      ),
    ]);
    setTables((prev) => prev.map((t) => ({ ...t, _dirty: false })));
    setDecor((prev) => prev.map((d) => ({ ...d, _dirty: false })));
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
      setSelected(new Set([`t:${t.id}` as ItemKey]));
      router.refresh();
    }
  }

  async function addDecor(kind: DecorKind) {
    const sz = decorDefaultSize[kind];
    const res = await fetch("/api/decor", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, posX: 80, posY: 80, width: sz.w, height: sz.h }),
    });
    if (res.ok) {
      const d = await res.json();
      setDecor((prev) => [...prev, d]);
      setSelected(new Set([`d:${d.id}` as ItemKey]));
      setPaletteOpen(false);
      router.refresh();
    }
  }

  const hasTableInSelection = useMemo(
    () => Array.from(selected).some((k) => k.startsWith("t:")),
    [selected],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          <p>
            {selected.size === 0
              ? "Trascina, ridimensiona dall'angolo. Shift-click per selezione multipla."
              : `${selected.size} element${selected.size > 1 ? "i" : "o"} selezionat${selected.size > 1 ? "i" : "o"} · ${dirtyCount} modifiche da salvare`}
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
          <Button variant="subtle" size="sm" onClick={() => rotateSelected(15)} disabled={selected.size === 0}>
            <RotateCw className="h-4 w-4" /> Ruota
          </Button>
          <Button variant="subtle" size="sm" onClick={cycleShape} disabled={!hasTableInSelection}>
            <Shapes className="h-4 w-4" /> Forma
          </Button>
          <Button variant="subtle" size="sm" onClick={toggleActive} disabled={!hasTableInSelection}>
            {tables.some((t) => selected.has(`t:${t.id}` as ItemKey) && !t.active) ? (
              <><Eye className="h-4 w-4" /> Attiva</>
            ) : (
              <><EyeOff className="h-4 w-4" /> Disattiva</>
            )}
          </Button>
          <Button variant="subtle" size="sm" onClick={deleteSelected} disabled={selected.size === 0}>
            <Trash2 className="h-4 w-4" /> Elimina
          </Button>
          <span className="hidden h-5 w-px bg-border md:inline-block" />
          <Button variant="subtle" size="sm" onClick={addTable}>
            <Plus className="h-4 w-4" /> Tavolo
          </Button>
          <div className="relative">
            <Button
              variant="subtle"
              size="sm"
              onClick={() => setPaletteOpen((v) => !v)}
            >
              <Plus className="h-4 w-4" /> Arredo <ChevronDown className="h-3 w-3" />
            </Button>
            {paletteOpen && (
              <div className="absolute right-0 top-full z-30 mt-1 grid w-72 grid-cols-2 gap-1 rounded-lg border bg-background p-2 shadow-xl">
                {PALETTE_KINDS.map((k) => {
                  const m = decorMeta[k];
                  const Icon = m.icon;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => addDecor(k)}
                      className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-secondary"
                    >
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      {m.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
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
        {decor.map((d) => {
          const key = `d:${d.id}` as ItemKey;
          const isSelected = selected.has(key);
          const m = decorMeta[d.kind];
          const Icon = m.icon;
          return (
            <div
              key={d.id}
              role="button"
              tabIndex={0}
              onMouseDown={(e) => onItemMouseDown(key, e)}
              className={cn(
                "group absolute select-none cursor-grab active:cursor-grabbing border rounded-md flex items-center justify-center gap-1.5 text-[10px] transition-shadow",
                m.tone,
                isSelected && "ring-4 ring-gilt/70 shadow-xl z-10",
              )}
              style={{
                left: d.posX,
                top: d.posY,
                width: d.width,
                height: d.height,
                transform: `rotate(${d.rotation}deg)`,
                transformOrigin: "center",
              }}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {(d.label || d.width >= 80) && (
                <span className="truncate px-1">{d.label || m.label}</span>
              )}
              {isSelected && (
                <span
                  onMouseDown={(e) => onResizeMouseDown(key, e)}
                  className="absolute -bottom-1 -right-1 h-3 w-3 cursor-nwse-resize rounded-sm border border-white bg-gilt"
                  title="Ridimensiona"
                />
              )}
            </div>
          );
        })}

        {tables.map((t) => {
          const key = `t:${t.id}` as ItemKey;
          const isSelected = selected.has(key);
          const sz = tableSize(t);
          return (
            <div
              key={t.id}
              role="button"
              tabIndex={0}
              onMouseDown={(e) => onItemMouseDown(key, e)}
              className={cn(
                "absolute grid place-items-center select-none transition-shadow shadow-md hover:shadow-lg cursor-grab active:cursor-grabbing",
                t.shape === "ROUND" && "rounded-full",
                t.shape === "SQUARE" && "rounded-md",
                t.shape === "RECT" && "rounded-md",
                t.shape === "BOOTH" && "rounded-2xl",
                t.shape === "LOUNGE" && "rounded-3xl",
                t.active ? "bg-carbon-800 text-sand-50" : "bg-muted text-muted-foreground",
                isSelected && "ring-4 ring-gilt/70 shadow-xl z-10",
              )}
              style={{
                left: t.posX,
                top: t.posY,
                width: sz.w,
                height: sz.h,
                transform: `rotate(${t.rotation}deg)`,
                transformOrigin: "center",
              }}
            >
              <span className="text-display text-sm font-semibold pointer-events-none">{t.label}</span>
              <span className="text-[10px] opacity-70 pointer-events-none">{t.seats} posti</span>
              {!t.active && <Lock className="absolute right-1 top-1 h-3 w-3 pointer-events-none" />}
              {isSelected && (
                <span
                  onMouseDown={(e) => onResizeMouseDown(key, e)}
                  className="absolute -bottom-1 -right-1 h-3 w-3 cursor-nwse-resize rounded-sm border border-white bg-gilt"
                  title="Ridimensiona"
                />
              )}
            </div>
          );
        })}
      </div>

      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer inline-flex items-center gap-1.5">
          <Keyboard className="h-3.5 w-3.5" /> Scorciatoie
        </summary>
        <div className="mt-2 grid gap-1 sm:grid-cols-2">
          <Shortcut k="Click" v="seleziona elemento" />
          <Shortcut k="Shift + Click" v="aggiungi/togli dalla selezione" />
          <Shortcut k="Trascina" v="muovi (con snap se attivo)" />
          <Shortcut k="Trascina angolino oro" v="ridimensiona elemento" />
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
