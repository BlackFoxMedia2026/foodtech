"use client";

import { useState } from "react";
import Image from "next/image";
import { ShieldCheck, ShieldOff, KeyRound, Copy, Download, Printer, RefreshCw } from "lucide-react";
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
import { useToast } from "@/components/ui/toast";

// Stage = "show-codes" appare DOPO una conferma riuscita o un regenerate:
// l'utente vede la lista in chiaro UNA volta sola e deve confermare di averla
// salvata. Da quel momento solo gli hash restano in DB.
type Stage = "idle" | "confirm" | "disable" | "show-codes" | "regenerate";

type SetupResponse = {
  secret: string;
  otpauth_url: string;
  qrCodeUrl: string;
};

export function SecurityCard({
  initialEnabled,
  initialRecoveryCodesRemaining,
}: {
  initialEnabled: boolean;
  initialRecoveryCodesRemaining: number;
}) {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [recoveryRemaining, setRecoveryRemaining] = useState(
    initialRecoveryCodesRemaining,
  );
  const [stage, setStage] = useState<Stage>("idle");
  const [setupData, setSetupData] = useState<SetupResponse | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  async function startSetup() {
    setBusy(true);
    try {
      const res = await fetch("/api/auth/2fa/setup", { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(
          "Setup 2FA non riuscito",
          body.error === "already_enabled"
            ? "Il 2FA è già attivo."
            : "Riprova fra qualche secondo.",
        );
        setBusy(false);
        return;
      }
      const data = (await res.json()) as SetupResponse;
      setSetupData(data);
      setStage("confirm");
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  async function confirmCode() {
    setBusy(true);
    try {
      const res = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(
          "Codice 2FA errato",
          body.error === "too_many_attempts"
            ? "Troppi tentativi, riprova fra qualche minuto."
            : "Verifica l'orario del device e riprova.",
        );
        setBusy(false);
        return;
      }
      const body = (await res.json()) as { ok: true; recoveryCodes?: string[] };
      toast.success("2FA attivato");
      setEnabled(true);
      setSetupData(null);
      setCode("");
      if (body.recoveryCodes && body.recoveryCodes.length > 0) {
        setRecoveryCodes(body.recoveryCodes);
        setRecoveryRemaining(body.recoveryCodes.length);
        setStage("show-codes");
      } else {
        setStage("idle");
      }
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const res = await fetch("/api/auth/2fa/disable", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(
          "Disattivazione non riuscita",
          body.error === "too_many_attempts"
            ? "Troppi tentativi, riprova fra qualche minuto."
            : "Codice TOTP errato.",
        );
        setBusy(false);
        return;
      }
      toast.success("2FA disattivato");
      setEnabled(false);
      setRecoveryRemaining(0);
      setStage("idle");
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  async function regenerateRecoveryCodes() {
    setBusy(true);
    try {
      const res = await fetch("/api/auth/2fa/recovery-codes/regenerate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ totpCode: code.trim() }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(
          "Rigenerazione non riuscita",
          body.error === "too_many_attempts"
            ? "Troppi tentativi, riprova fra qualche minuto."
            : "Codice TOTP errato.",
        );
        setBusy(false);
        return;
      }
      const body = (await res.json()) as { ok: true; recoveryCodes: string[] };
      setRecoveryCodes(body.recoveryCodes);
      setRecoveryRemaining(body.recoveryCodes.length);
      setCode("");
      setStage("show-codes");
      toast.success("Nuovi recovery codes generati");
    } finally {
      setBusy(false);
    }
  }

  // ─── Recovery codes helpers ────────────────────────────────────────────────
  const codesPlainText = recoveryCodes.join("\n");

  async function copyAllCodes() {
    try {
      await navigator.clipboard.writeText(codesPlainText);
      toast.success("Codici copiati");
    } catch {
      toast.error("Copia non riuscita");
    }
  }

  function downloadCodes() {
    const blob = new Blob(
      [
        "Tavolo · Recovery codes 2FA\n",
        "Conserva questo file in un posto sicuro.\n",
        "Ogni codice si usa una sola volta.\n\n",
        codesPlainText,
        "\n",
      ],
      { type: "text/plain;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tavolo-recovery-codes.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function printCodes() {
    const w = window.open("", "_blank", "noopener");
    if (!w) return;
    w.document.write(
      `<!doctype html><html><head><title>Recovery codes Tavolo</title>
       <style>body{font:14px/1.5 system-ui;padding:32px;color:#111}
       h1{font-size:18px;margin:0 0 12px}
       p{margin:0 0 16px;color:#555}
       ul{list-style:none;padding:0;margin:0;font-family:ui-monospace,monospace;font-size:16px}
       li{padding:4px 0;border-bottom:1px dashed #ddd}</style></head>
       <body><h1>Recovery codes Tavolo</h1>
       <p>Ogni codice si usa una sola volta. Conservali in un posto sicuro.</p>
       <ul>${recoveryCodes.map((c) => `<li>${c}</li>`).join("")}</ul>
       <script>window.onload=()=>window.print()</script>
       </body></html>`,
    );
    w.document.close();
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Sicurezza account
            </CardTitle>
            <CardDescription>
              Aggiungi un secondo fattore TOTP (Google Authenticator, 1Password,
              Authy…) per proteggere l&apos;accesso anche se la password viene
              compromessa.
            </CardDescription>
          </div>
          {enabled ? (
            <Badge tone="success">2FA attivo</Badge>
          ) : (
            <Badge tone="warning">2FA non attivo</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!enabled && stage === "idle" && (
          <Button type="button" variant="gold" onClick={startSetup} disabled={busy}>
            <KeyRound className="h-3.5 w-3.5" /> Attiva 2FA
          </Button>
        )}

        {!enabled && stage === "confirm" && setupData && (
          <div className="space-y-3 rounded-md border bg-background p-3">
            <p className="text-sm">
              Scansiona il QR con la tua app di autenticazione, poi inserisci il
              codice a 6 cifre per confermare.
            </p>
            <div className="flex flex-wrap items-start gap-4">
              <div className="rounded-md border bg-white p-2">
                <Image
                  src={setupData.qrCodeUrl}
                  alt="QR code 2FA"
                  width={180}
                  height={180}
                  unoptimized
                />
              </div>
              <div className="flex-1 space-y-2 text-xs">
                <p className="text-muted-foreground">
                  Non puoi scansionare? Inserisci manualmente questo codice:
                </p>
                <code className="block rounded bg-muted px-2 py-1 font-mono text-[11px] break-all">
                  {setupData.secret}
                </code>
                <a
                  href={setupData.otpauth_url}
                  className="text-muted-foreground underline-offset-2 hover:underline"
                >
                  Apri nell&apos;app
                </a>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-code">Codice di conferma</Label>
              <Input
                id="confirm-code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStage("idle");
                  setSetupData(null);
                  setCode("");
                }}
                disabled={busy}
              >
                Annulla
              </Button>
              <Button
                type="button"
                variant="gold"
                size="sm"
                onClick={confirmCode}
                disabled={busy || code.length !== 6}
              >
                {busy ? "Verifica…" : "Conferma"}
              </Button>
            </div>
          </div>
        )}

        {stage === "show-codes" && (
          <div className="space-y-3 rounded-md border border-amber-300 bg-amber-50 p-3 dark:bg-amber-950/30">
            <div>
              <p className="text-sm font-medium">
                Salva questi 10 recovery codes
              </p>
              <p className="text-xs text-muted-foreground">
                Non li rivedrai più. Ogni codice si usa una sola volta. Usali se
                perdi l&apos;app di autenticazione.
              </p>
            </div>
            <ul className="grid grid-cols-2 gap-1.5 rounded-md border bg-background p-3 font-mono text-sm">
              {recoveryCodes.map((c) => (
                <li key={c} className="select-all">
                  {c}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={copyAllCodes}>
                <Copy className="h-3.5 w-3.5" /> Copia tutti
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={downloadCodes}>
                <Download className="h-3.5 w-3.5" /> Scarica TXT
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={printCodes}>
                <Printer className="h-3.5 w-3.5" /> Stampa
              </Button>
              <div className="grow" />
              <Button
                type="button"
                size="sm"
                variant="gold"
                onClick={() => {
                  setRecoveryCodes([]);
                  setStage("idle");
                }}
              >
                Ho salvato i codici
              </Button>
            </div>
          </div>
        )}

        {enabled && stage === "idle" && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3 rounded-md border bg-background p-3 text-sm">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <p className="font-medium">Recovery codes</p>
                <p className="text-xs text-muted-foreground">
                  Rimasti: {recoveryRemaining}/10 ·{" "}
                  {recoveryRemaining <= 3
                    ? "Stai per esaurirli, rigenerali."
                    : "Tienili al sicuro per emergenze."}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setStage("regenerate");
                  setCode("");
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" /> Rigenera
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setStage("disable");
                setCode("");
              }}
            >
              <ShieldOff className="h-3.5 w-3.5" /> Disattiva 2FA
            </Button>
          </div>
        )}

        {enabled && stage === "regenerate" && (
          <div className="space-y-3 rounded-md border bg-background p-3">
            <p className="text-sm">
              Inserisci il codice TOTP corrente per generare 10 nuovi recovery
              codes. I codici esistenti verranno invalidati.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="regen-code">Codice 2FA</Label>
              <Input
                id="regen-code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStage("idle");
                  setCode("");
                }}
                disabled={busy}
              >
                Annulla
              </Button>
              <Button
                type="button"
                variant="gold"
                size="sm"
                onClick={regenerateRecoveryCodes}
                disabled={busy || code.length !== 6}
              >
                {busy ? "Generazione…" : "Rigenera"}
              </Button>
            </div>
          </div>
        )}

        {enabled && stage === "disable" && (
          <div className="space-y-3 rounded-md border bg-background p-3">
            <p className="text-sm">
              Inserisci il codice TOTP corrente per confermare la disattivazione.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="disable-code">Codice 2FA</Label>
              <Input
                id="disable-code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStage("idle");
                  setCode("");
                }}
                disabled={busy}
              >
                Annulla
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={disable}
                disabled={busy || code.length !== 6}
              >
                {busy ? "Disattivazione…" : "Disattiva"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Riceverai una mail di conferma all&apos;indirizzo dell&apos;account.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
