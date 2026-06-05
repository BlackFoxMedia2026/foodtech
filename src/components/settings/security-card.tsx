"use client";

import { useState } from "react";
import Image from "next/image";
import { ShieldCheck, ShieldOff, KeyRound } from "lucide-react";
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

type Stage = "idle" | "setup" | "confirm" | "disable";

type SetupResponse = {
  secret: string;
  otpauth_url: string;
  qrCodeUrl: string;
};

export function SecurityCard({ initialEnabled }: { initialEnabled: boolean }) {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [stage, setStage] = useState<Stage>("idle");
  const [setupData, setSetupData] = useState<SetupResponse | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

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
        toast.error("Codice 2FA errato", "Verifica l'orario del device e riprova.");
        setBusy(false);
        return;
      }
      toast.success("2FA attivato");
      setEnabled(true);
      setStage("idle");
      setSetupData(null);
      setCode("");
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
        toast.error("Disattivazione non riuscita", "Codice TOTP errato.");
        setBusy(false);
        return;
      }
      toast.success("2FA disattivato");
      setEnabled(false);
      setStage("idle");
      setCode("");
    } finally {
      setBusy(false);
    }
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
                {/* unoptimized: il QR arriva da provider esterno, non vogliamo
                    farlo passare per /_next/image. */}
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

        {enabled && stage === "idle" && (
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}
