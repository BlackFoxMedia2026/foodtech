"use client";

import { useEffect, useState } from "react";
import { Copy, KeyRound, Plus, Trash2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const SCOPES = [
  { value: "bookings:read", label: "Prenotazioni · lettura" },
  { value: "bookings:write", label: "Prenotazioni · scrittura" },
  { value: "orders:read", label: "Ordini · lettura" },
  { value: "guests:read", label: "Ospiti · lettura" },
  { value: "menu:read", label: "Menu · lettura" },
  { value: "messages:read", label: "Messaggi · lettura" },
  { value: "reviews:read", label: "Recensioni · lettura" },
];

type Token = {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

export function ApiTokensCard() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["bookings:read"]);
  const [expiresInDays, setExpiresInDays] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ name: string; token: string } | null>(null);

  async function load() {
    const res = await fetch("/api/api-tokens");
    if (!res.ok) return;
    const j = (await res.json()) as Token[];
    setTokens(j);
  }
  useEffect(() => {
    void load();
  }, []);

  function toggleScope(s: string) {
    setScopes((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  }

  async function create() {
    setBusy(true);
    setError(null);
    setIssued(null);
    const res = await fetch("/api/api-tokens", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        scopes,
        expiresInDays: expiresInDays ? Number(expiresInDays) : undefined,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b?.error === "invalid_input" ? "Controlla i campi." : "Creazione non riuscita.");
      return;
    }
    const j = (await res.json()) as { token: string };
    setIssued({ name: name.trim(), token: j.token });
    setName("");
    setScopes(["bookings:read"]);
    setExpiresInDays("");
    setCreating(false);
    await load();
  }

  async function revoke(id: string) {
    if (!confirm("Revocare il token? Le integrazioni che lo usano smetteranno di funzionare.")) return;
    await fetch(`/api/api-tokens/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" /> API tokens
            </CardTitle>
            <CardDescription>
              Crea token per integrazioni esterne (POS, dashboard interne, scripts).
              Esponiamo <code>/api/v1/me</code>, <code>/v1/bookings</code>,{" "}
              <code>/v1/orders</code>, <code>/v1/guests</code>, <code>/v1/menu</code>.
            </CardDescription>
          </div>
          <Button type="button" variant="gold" size="sm" onClick={() => setCreating((v) => !v)}>
            <Plus className="h-3.5 w-3.5" /> Nuovo token
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {issued && (
          <div className="space-y-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            <p className="font-medium">Token &ldquo;{issued.name}&rdquo; creato.</p>
            <p className="text-xs">Copialo ora: per sicurezza non sarà più mostrato in chiaro.</p>
            <div className="flex items-center gap-2">
              <Input
                value={issued.token}
                readOnly
                className="font-mono text-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => navigator.clipboard?.writeText(issued.token)}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {creating && (
          <div className="space-y-3 rounded-md border bg-background p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tk-name">Nome (visibile solo a te)</Label>
                <Input
                  id="tk-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={120}
                  placeholder="Es. zapier-prod"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tk-exp">Scadenza (giorni, opzionale)</Label>
                <Input
                  id="tk-exp"
                  type="number"
                  min={1}
                  max={3650}
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(e.target.value)}
                  placeholder="∞"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Scope</Label>
              <div className="grid gap-1 sm:grid-cols-2">
                {SCOPES.map((s) => (
                  <label
                    key={s.value}
                    className="flex items-center gap-2 rounded-md border bg-background px-2 py-1 text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={scopes.includes(s.value)}
                      onChange={() => toggleScope(s.value)}
                    />
                    <span>{s.label}</span>
                  </label>
                ))}
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setCreating(false)}>
                Annulla
              </Button>
              <Button
                type="button"
                variant="gold"
                size="sm"
                onClick={create}
                disabled={busy || !name.trim() || scopes.length === 0}
              >
                {busy ? "Creazione…" : "Crea token"}
              </Button>
            </div>
          </div>
        )}

        {tokens.length === 0 ? (
          <p className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">
            Ancora nessun token.
          </p>
        ) : (
          <ul className="divide-y text-sm">
            {tokens.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="font-medium">
                    {t.name}{" "}
                    {t.revokedAt && <Badge tone="danger">revocato</Badge>}
                    {!t.revokedAt && t.expiresAt && new Date(t.expiresAt) < new Date() && (
                      <Badge tone="warning">scaduto</Badge>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <code>{t.prefix}…</code> · scope {t.scopes.join(", ") || "—"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {t.lastUsedAt
                      ? `Ultimo uso ${new Date(t.lastUsedAt).toLocaleString("it-IT")}`
                      : "Mai usato"}
                    {t.expiresAt
                      ? ` · scade ${new Date(t.expiresAt).toLocaleDateString("it-IT")}`
                      : ""}
                  </p>
                </div>
                {!t.revokedAt && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => revoke(t.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Revoca
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
