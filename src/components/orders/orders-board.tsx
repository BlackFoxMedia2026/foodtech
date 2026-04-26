"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChefHat,
  Clock,
  Phone,
  ShoppingBag,
  Truck,
  XCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency, formatTime } from "@/lib/utils";

type Item = {
  id: string;
  name: string;
  priceCents: number;
  quantity: number;
  notes: string | null;
};

type Order = {
  id: string;
  reference: string;
  kind: "TAKEAWAY" | "DELIVERY" | "TABLE";
  status: "RECEIVED" | "PREPARING" | "READY" | "ON_THE_WAY" | "COMPLETED" | "CANCELLED";
  customerName: string;
  phone: string;
  email: string | null;
  address: string | null;
  scheduledAt: string;
  totalCents: number;
  notes: string | null;
  items: Item[];
};

const COLUMNS: { key: Order["status"][]; label: string; tone: string }[] = [
  { key: ["RECEIVED"], label: "Ricevuti", tone: "border-amber-200 bg-amber-50/40" },
  { key: ["PREPARING"], label: "In preparazione", tone: "border-violet-200 bg-violet-50/40" },
  { key: ["READY", "ON_THE_WAY"], label: "Pronti / In consegna", tone: "border-sky-200 bg-sky-50/40" },
  { key: ["COMPLETED", "CANCELLED"], label: "Chiusi", tone: "border-stone-200 bg-stone-50/40" },
];

const NEXT_STATUS: Record<Order["status"], Order["status"] | null> = {
  RECEIVED: "PREPARING",
  PREPARING: "READY",
  READY: "COMPLETED",
  ON_THE_WAY: "COMPLETED",
  COMPLETED: null,
  CANCELLED: null,
};

export function OrdersBoard({ initial, currency }: { initial: Order[]; currency: string }) {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const grouped = useMemo(() => {
    const map = new Map<string, Order[]>();
    for (const c of COLUMNS) map.set(c.label, []);
    for (const o of orders) {
      const col = COLUMNS.find((c) => c.key.includes(o.status));
      if (col) map.get(col.label)!.push(o);
    }
    return map;
  }, [orders]);

  async function patch(id: string, status: Order["status"]) {
    setBusyId(id);
    setOrders((curr) => curr.map((o) => (o.id === id ? { ...o, status } : o)));
    const res = await fetch(`/api/orders/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusyId(null);
    if (!res.ok) startTransition(() => router.refresh());
  }

  if (orders.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
        Nessun ordine ricevuto. I clienti possono ordinare dal menu pubblico tramite link/QR.
      </p>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-4">
      {COLUMNS.map((col) => {
        const items = grouped.get(col.label) ?? [];
        return (
          <section key={col.label} className={cn("flex flex-col rounded-lg border", col.tone)}>
            <header className="flex items-baseline justify-between border-b px-4 py-3">
              <h2 className="text-display text-base">{col.label}</h2>
              <span className="rounded-full border bg-background px-2 py-0.5 text-xs">
                {items.length}
              </span>
            </header>
            <div className="flex flex-col gap-2 p-2">
              {items.length === 0 ? (
                <p className="rounded-md border border-dashed bg-background/50 p-4 text-center text-xs text-muted-foreground">
                  vuoto
                </p>
              ) : (
                items.map((o) => (
                  <Card key={o.id} className="bg-background">
                    <CardContent className="space-y-2 p-3 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="flex items-center gap-1 font-medium">
                            {o.kind === "DELIVERY" ? (
                              <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <ShoppingBag className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                            {o.customerName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            <Clock className="mr-1 inline h-3 w-3" />
                            {formatTime(o.scheduledAt)} · #{o.reference.slice(-6).toUpperCase()}
                          </p>
                        </div>
                        <Badge tone="gold">{formatCurrency(o.totalCents, currency)}</Badge>
                      </div>

                      <ul className="rounded-md border bg-secondary/40 p-2 text-xs">
                        {o.items.map((it) => (
                          <li key={it.id} className="flex justify-between">
                            <span>
                              {it.quantity}× {it.name}
                              {it.notes && <span className="text-muted-foreground"> · {it.notes}</span>}
                            </span>
                            <span>{formatCurrency(it.priceCents * it.quantity, currency)}</span>
                          </li>
                        ))}
                      </ul>

                      <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" /> {o.phone}
                      </p>
                      {o.address && (
                        <p className="text-xs text-muted-foreground">📍 {o.address}</p>
                      )}
                      {o.notes && (
                        <p className="rounded-md bg-amber-50 px-2 py-1 text-xs italic text-amber-800">
                          {o.notes}
                        </p>
                      )}

                      {NEXT_STATUS[o.status] && (
                        <div className="flex gap-1">
                          <Button
                            variant="gold"
                            size="sm"
                            disabled={busyId === o.id}
                            onClick={() => patch(o.id, NEXT_STATUS[o.status]!)}
                            className="flex-1"
                          >
                            {o.status === "RECEIVED" && (
                              <>
                                <ChefHat className="h-3.5 w-3.5" /> In preparazione
                              </>
                            )}
                            {o.status === "PREPARING" && (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5" /> Pronto
                              </>
                            )}
                            {(o.status === "READY" || o.status === "ON_THE_WAY") && (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5" /> Completato
                              </>
                            )}
                          </Button>
                          {o.status === "READY" && o.kind === "DELIVERY" && (
                            <Button
                              variant="subtle"
                              size="sm"
                              disabled={busyId === o.id}
                              onClick={() => patch(o.id, "ON_THE_WAY")}
                            >
                              <Truck className="h-3.5 w-3.5" /> In consegna
                            </Button>
                          )}
                          {o.status !== "COMPLETED" && o.status !== "CANCELLED" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={busyId === o.id}
                              onClick={() => patch(o.id, "CANCELLED")}
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
