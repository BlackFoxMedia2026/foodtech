"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, ChefHat, RefreshCw, Soup, Truck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Ticket = {
  id: string;
  source: "ORDER" | "PREORDER";
  reference: string;
  status: string;
  customerName: string;
  partyOrSize: number;
  notes: string | null;
  scheduledAt: string;
  totalCents: number;
  currency: string;
  items: { id: string; name: string; quantity: number; notes: string | null }[];
  bookingId?: string;
  orderId?: string;
  pickupOrTable?: string | null;
};

type Filter = "ALL" | "ORDER" | "PREORDER";

const ORDER_NEXT: Record<string, { label: string; status: string } | null> = {
  RECEIVED: { label: "Inizia", status: "PREPARING" },
  PREPARING: { label: "Pronto", status: "READY" },
  READY: { label: "Consegnato", status: "COMPLETED" },
  ON_THE_WAY: { label: "Consegnato", status: "COMPLETED" },
};

const PREORDER_NEXT: Record<string, { label: string; status: string } | null> = {
  DRAFT: { label: "Conferma", status: "CONFIRMED" },
  CONFIRMED: { label: "Pronto", status: "PREPARED" },
  PREPARED: null,
};

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral" | "info" | "gold"> = {
  RECEIVED: "info",
  PREPARING: "warning",
  READY: "success",
  ON_THE_WAY: "info",
  COMPLETED: "neutral",
  DRAFT: "neutral",
  CONFIRMED: "info",
  PREPARED: "success",
  CANCELLED: "danger",
};

export function KitchenBoard({ initialTickets }: { initialTickets: Ticket[] }) {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [auto, setAuto] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);

  // Polling refresh every 30s when auto is on. Re-fetch the whole page rather
  // than building a dedicated SSE channel — operationally fine for a single
  // venue with ~tens of tickets.
  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(id);
  }, [auto, router]);

  // Sync state when server re-renders (router.refresh()).
  useEffect(() => {
    setTickets(initialTickets);
  }, [initialTickets]);

  // Tiny audio bell when a new ticket appears (not on first paint).
  const [seenIds, setSeenIds] = useState(() => new Set(initialTickets.map((t) => t.id)));
  useEffect(() => {
    if (muted) {
      setSeenIds(new Set(initialTickets.map((t) => t.id)));
      return;
    }
    const fresh = initialTickets.filter((t) => !seenIds.has(t.id));
    if (fresh.length > 0) {
      try {
        const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const osc = ctx.createOscillator();
        osc.frequency.value = 880;
        osc.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } catch {
        // ignore audio context errors (no user gesture yet, etc.)
      }
    }
    setSeenIds(new Set(initialTickets.map((t) => t.id)));
  }, [initialTickets, muted, seenIds]);

  const visible = useMemo(
    () => tickets.filter((t) => filter === "ALL" || t.source === filter),
    [tickets, filter],
  );

  async function advance(t: Ticket) {
    setBusy(t.id);
    if (t.source === "ORDER" && t.orderId) {
      const next = ORDER_NEXT[t.status]?.status;
      if (next) {
        await fetch(`/api/orders/${t.orderId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: next }),
        });
      }
    } else if (t.source === "PREORDER" && t.bookingId) {
      const next = PREORDER_NEXT[t.status]?.status;
      if (next) {
        await fetch(`/api/bookings/${t.bookingId}/preorder/status`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: next }),
        });
      }
    }
    setBusy(null);
    router.refresh();
  }

  async function cancel(t: Ticket) {
    if (!confirm(`Annullare ${t.reference}?`)) return;
    setBusy(t.id);
    if (t.source === "ORDER" && t.orderId) {
      await fetch(`/api/orders/${t.orderId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });
    } else if (t.source === "PREORDER" && t.bookingId) {
      await fetch(`/api/bookings/${t.bookingId}/preorder/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });
    }
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-background p-3">
        <div className="inline-flex rounded-md border bg-secondary/40 p-0.5">
          {(["ALL", "PREORDER", "ORDER"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "rounded px-3 py-1 text-xs font-medium",
                filter === f
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-background",
              )}
            >
              {f === "ALL" ? "Tutti" : f === "PREORDER" ? "Pre-order sala" : "Asporto / delivery"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <label className="inline-flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={auto}
              onChange={(e) => setAuto(e.target.checked)}
            />
            Auto-refresh 30s
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setMuted((v) => !v)}
          >
            <Bell className={cn("h-3.5 w-3.5", muted && "opacity-30")} />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.refresh()}
          >
            <RefreshCw className="h-3.5 w-3.5" /> Aggiorna
          </Button>
        </div>
      </div>

      {visible.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nessun ticket attivo. Goditi la pace della cucina ✨
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((t) => {
            const next =
              t.source === "ORDER" ? ORDER_NEXT[t.status] : PREORDER_NEXT[t.status];
            const Icon = t.source === "ORDER" ? Truck : Soup;
            const cur = (t.totalCents / 100).toFixed(2);
            return (
              <Card
                key={t.id}
                className={cn(
                  "border-l-4",
                  t.source === "ORDER"
                    ? "border-l-sky-500"
                    : "border-l-gilt",
                )}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Icon className="h-4 w-4" />
                        {t.customerName}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        #{t.reference} · {t.pickupOrTable ?? ""} ·{" "}
                        {new Date(t.scheduledAt).toLocaleTimeString("it-IT", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {t.partyOrSize > 1 && ` · ${t.partyOrSize} pax`}
                      </p>
                    </div>
                    <Badge tone={STATUS_TONE[t.status] ?? "neutral"}>{t.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <ul className="space-y-1">
                    {t.items.map((it) => (
                      <li key={it.id} className="flex items-baseline justify-between gap-2">
                        <span>
                          <span className="mr-2 inline-block min-w-[1.4rem] rounded bg-secondary px-1 text-xs font-mono">
                            {it.quantity}×
                          </span>
                          {it.name}
                          {it.notes && (
                            <span className="ml-2 text-xs italic text-muted-foreground">
                              · {it.notes}
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {t.notes && (
                    <p className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900">
                      ⚠️ {t.notes}
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-xs text-muted-foreground">
                      {cur} {t.currency}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => cancel(t)}
                        disabled={busy === t.id}
                      >
                        Annulla
                      </Button>
                      {next ? (
                        <Button
                          type="button"
                          variant="gold"
                          size="sm"
                          onClick={() => advance(t)}
                          disabled={busy === t.id}
                        >
                          <Check className="h-3.5 w-3.5" /> {next.label}
                        </Button>
                      ) : (
                        <Badge tone="success">
                          <ChefHat className="mr-1 inline h-3 w-3" />
                          Pronto
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
