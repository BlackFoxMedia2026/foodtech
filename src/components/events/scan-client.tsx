"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ScanLine, AlertTriangle, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

type Result =
  | { kind: "ok"; buyerName: string; quantity: number; experienceTitle: string; startsAt: string }
  | { kind: "already"; buyerName: string; quantity: number; experienceTitle: string; checkedInAt: string }
  | { kind: "error"; message: string };

export function ScanClient() {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [history, setHistory] = useState<{ at: string; result: Result }[]>([]);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, [result]);

  useEffect(() => {
    if (!value) return;
    const timer = setTimeout(() => {
      if (value.length > 5) void submit(value);
    }, 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  async function submit(id: string) {
    setBusy(true);
    setResult(null);
    const res = await fetch(`/api/tickets/check-in/${id}`, { method: "POST" });
    setBusy(false);
    if (res.ok) {
      const j = await res.json();
      const r: Result = {
        kind: "ok",
        buyerName: j.ticket.buyerName,
        quantity: j.ticket.quantity,
        experienceTitle: j.ticket.experienceTitle,
        startsAt: j.ticket.startsAt,
      };
      setResult(r);
      setHistory((h) => [{ at: new Date().toISOString(), result: r }, ...h].slice(0, 20));
    } else {
      const j = await res.json().catch(() => ({}));
      let r: Result;
      if (j?.error === "already_checked_in" && j?.ticket) {
        r = {
          kind: "already",
          buyerName: j.ticket.buyerName,
          quantity: j.ticket.quantity,
          experienceTitle: j.ticket.experienceTitle,
          checkedInAt: j.ticket.checkedInAt,
        };
      } else if (j?.error === "not_found") {
        r = { kind: "error", message: "Ticket non trovato." };
      } else if (j?.error === "wrong_venue") {
        r = { kind: "error", message: "Ticket di un altro locale." };
      } else if (j?.error === "invalid_status") {
        r = { kind: "error", message: `Stato ticket: ${j.status}.` };
      } else {
        r = { kind: "error", message: "Operazione non riuscita." };
      }
      setResult(r);
      setHistory((h) => [{ at: new Date().toISOString(), result: r }, ...h].slice(0, 20));
    }
    setValue("");
    setTimeout(() => ref.current?.focus(), 100);
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (value) void submit(value);
        }}
        className="flex gap-2"
      >
        <Input
          ref={ref}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Incolla o digita l'ID del ticket / scansiona QR"
          autoFocus
          autoComplete="off"
        />
        <Button type="submit" variant="gold" disabled={busy || !value}>
          <ScanLine className="h-4 w-4" /> Convalida
        </Button>
      </form>

      {result && (
        <div
          className={`rounded-lg border p-4 text-sm ${
            result.kind === "ok"
              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
              : result.kind === "already"
                ? "border-amber-300 bg-amber-50 text-amber-800"
                : "border-rose-300 bg-rose-50 text-rose-800"
          }`}
        >
          {result.kind === "ok" && (
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5" />
              <div>
                <p className="font-medium">Check-in OK · {result.quantity}× {result.buyerName}</p>
                <p className="text-xs">{result.experienceTitle} · {formatDateTime(result.startsAt)}</p>
              </div>
            </div>
          )}
          {result.kind === "already" && (
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5" />
              <div>
                <p className="font-medium">Ticket già usato · {result.buyerName} · {result.quantity}p</p>
                <p className="text-xs">
                  {result.experienceTitle} · check-in il {formatDateTime(result.checkedInAt)}
                </p>
              </div>
            </div>
          )}
          {result.kind === "error" && (
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5" />
              <div>
                <p className="font-medium">Errore</p>
                <p className="text-xs">{result.message}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {history.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Ultimi check-in
          </p>
          <ul className="space-y-1 text-xs">
            {history.map((h, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-md border bg-background px-3 py-2"
              >
                <span className="flex items-center gap-2">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  {formatDateTime(h.at)}
                  {h.result.kind === "ok" && <Badge tone="success">OK · {h.result.buyerName}</Badge>}
                  {h.result.kind === "already" && <Badge tone="warning">DUP · {h.result.buyerName}</Badge>}
                  {h.result.kind === "error" && <Badge tone="danger">{h.result.message}</Badge>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
