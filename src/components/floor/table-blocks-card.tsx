"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/utils";

type Block = {
  id: string;
  tableId: string;
  tableLabel: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
};

type Table = { id: string; label: string; seats: number };

export function TableBlocksCard({ initial, tables }: { initial: Block[]; tables: Table[] }) {
  const router = useRouter();
  const [list, setList] = useState<Block[]>(initial);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  async function remove(id: string) {
    if (!confirm("Sbloccare il tavolo?")) return;
    setBusy(true);
    await fetch(`/api/blocks/${id}`, { method: "DELETE" });
    setBusy(false);
    setList((l) => l.filter((b) => b.id !== id));
    startTransition(() => router.refresh());
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4" /> Blocchi tavoli
            </CardTitle>
            <CardDescription>
              I blocchi rendono un tavolo non assegnabile per una finestra di tempo (es. tavolo
              riservato a privé, manutenzione, evento). Il widget pubblico ne tiene conto.
            </CardDescription>
          </div>
          <NewBlockDialog
            tables={tables}
            onCreated={(b) => setList((l) => [...l, b])}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {list.length === 0 ? (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nessun tavolo bloccato.
          </p>
        ) : (
          list.map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
              <div>
                <div className="flex items-center gap-2">
                  <Badge tone="warning">{b.tableLabel}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(b.startsAt)} → {formatDateTime(b.endsAt)}
                  </span>
                </div>
                {b.reason && <p className="mt-1 text-xs italic text-muted-foreground">{b.reason}</p>}
              </div>
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => remove(b.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function NewBlockDialog({
  tables,
  onCreated,
}: {
  tables: Table[];
  onCreated: (b: Block) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="subtle" size="sm">
          <Plus className="h-4 w-4" /> Blocca tavolo
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Blocca tavolo</DialogTitle>
          <DialogDescription>Imposta la finestra in cui il tavolo non è assegnabile.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            const fd = new FormData(e.currentTarget);
            const startsAt = new Date(`${fd.get("date")}T${fd.get("startTime")}`).toISOString();
            const endsAt = new Date(`${fd.get("date")}T${fd.get("endTime")}`).toISOString();
            const res = await fetch("/api/blocks", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                tableId: fd.get("tableId"),
                startsAt,
                endsAt,
                reason: String(fd.get("reason") ?? "").trim() || null,
              }),
            });
            setBusy(false);
            if (!res.ok) {
              setError("Salvataggio non riuscito.");
              return;
            }
            const block = await res.json();
            onCreated({
              id: block.id,
              tableId: block.tableId,
              tableLabel: block.table?.label ?? "?",
              startsAt: block.startsAt,
              endsAt: block.endsAt,
              reason: block.reason,
            });
            setOpen(false);
            router.refresh();
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label>Tavolo</Label>
            <Select name="tableId" required>
              <SelectTrigger>
                <SelectValue placeholder="Scegli un tavolo" />
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
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="b-date">Data</Label>
              <Input
                id="b-date"
                name="date"
                type="date"
                required
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-start">Inizio</Label>
              <Input id="b-start" name="startTime" type="time" required defaultValue="19:00" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-end">Fine</Label>
              <Input id="b-end" name="endTime" type="time" required defaultValue="23:00" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-reason">Motivo (opzionale)</Label>
            <Input id="b-reason" name="reason" maxLength={200} placeholder="Privé, manutenzione, evento…" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Annulla
            </Button>
            <Button type="submit" variant="gold" disabled={busy}>
              {busy ? "Salvataggio…" : "Blocca"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
