"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  PlayCircle,
  Wifi,
} from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Setup = {
  portalLogoUrl: string | null;
  portalAccent: string | null;
  portalWelcome: string | null;
  portalLegal: string | null;
  autoCouponEnabled: boolean;
  autoCouponPercent: number;
  autoCouponDays: number;
  setupAt: string | null;
};

type Snippet = { kind: string; label: string; code: string };

type Props = {
  initial: Setup;
  captiveUrl: string;
  snippets: Snippet[];
  qrInitial: { url: string; dataUrl: string };
};

const STEPS = [
  { id: "brand", label: "Brand" },
  { id: "consent", label: "Consenso" },
  { id: "coupon", label: "Coupon" },
  { id: "qr", label: "QR & router" },
  { id: "test", label: "Test" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

const DEFAULT_WELCOME =
  "Connettiti gratis al Wi-Fi del locale. Lasciaci nome ed email: ti regaliamo un benvenuto.";
const DEFAULT_LEGAL =
  "Ai sensi del GDPR i tuoi dati saranno usati solo per offerte del locale. Puoi cancellarti in qualsiasi momento.";

export function WifiSetupWizard({ initial, captiveUrl, snippets, qrInitial }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<StepId>("brand");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [data, setData] = useState<Setup>(initial);
  const [qr, setQr] = useState(qrInitial);

  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const isLast = stepIndex === STEPS.length - 1;

  const accent = data.portalAccent || "#c9a25a";
  const welcome = data.portalWelcome || DEFAULT_WELCOME;
  const legal = data.portalLegal || DEFAULT_LEGAL;

  function patch(p: Partial<Setup>) {
    setData((prev) => ({ ...prev, ...p }));
  }

  async function save(opts?: { complete?: boolean }) {
    setBusy(true);
    setError(null);
    setSuccess(null);
    const res = await fetch("/api/wifi/setup", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        portalLogoUrl: data.portalLogoUrl,
        portalAccent: accent,
        portalWelcome: welcome,
        portalLegal: legal,
        autoCouponEnabled: data.autoCouponEnabled,
        autoCouponPercent: data.autoCouponPercent,
        autoCouponDays: data.autoCouponDays,
        markComplete: opts?.complete,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b?.error === "invalid_input" ? "Controlla i campi." : "Salvataggio non riuscito.");
      return false;
    }
    const fresh = (await res.json()) as Setup;
    setData(fresh);
    setSuccess(opts?.complete ? "Configurazione completata!" : "Salvato.");
    router.refresh();
    return true;
  }

  async function refreshQr() {
    setBusy(true);
    const res = await fetch("/api/wifi/setup/qr");
    setBusy(false);
    if (!res.ok) return;
    const json = (await res.json()) as { url: string; dataUrl: string };
    setQr(json);
  }

  async function downloadSvg() {
    window.open("/api/wifi/setup/qr?format=svg", "_blank");
  }

  async function runTest() {
    setBusy(true);
    setError(null);
    setSuccess(null);
    const res = await fetch("/api/wifi/setup/test", { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(`Test fallito: ${b.error ?? "errore"}`);
      return;
    }
    setSuccess(
      "Lead di test creato: lo trovi in fondo all'elenco con il marker wizard-test. Se il coupon automatico è attivo è già stato emesso.",
    );
    router.refresh();
  }

  function copy(text: string) {
    navigator.clipboard?.writeText(text).then(
      () => setSuccess("Copiato negli appunti."),
      () => setError("Impossibile copiare."),
    );
  }

  function next() {
    if (isLast) return;
    setStep(STEPS[stepIndex + 1].id);
  }

  function back() {
    if (stepIndex === 0) return;
    setStep(STEPS[stepIndex - 1].id);
  }

  return (
    <div className="space-y-6">
      <ol className="flex flex-wrap items-center gap-2 text-xs">
        {STEPS.map((s, i) => {
          const done = i < stepIndex;
          const active = i === stepIndex;
          return (
            <li key={s.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStep(s.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1",
                  active
                    ? "border-foreground bg-foreground text-background"
                    : done
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                      : "border-border bg-background text-muted-foreground hover:bg-secondary",
                )}
              >
                {done ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <span className="grid h-4 w-4 place-items-center rounded-full border text-[10px]">
                    {i + 1}
                  </span>
                )}
                {s.label}
              </button>
              {i < STEPS.length - 1 && <span className="text-muted-foreground">›</span>}
            </li>
          );
        })}
      </ol>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{STEPS[stepIndex].label}</CardTitle>
            <CardDescription>{descriptionFor(step)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {step === "brand" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ws-logo">Logo URL (opzionale)</Label>
                  <Input
                    id="ws-logo"
                    type="url"
                    value={data.portalLogoUrl ?? ""}
                    onChange={(e) => patch({ portalLogoUrl: e.target.value || null })}
                    placeholder="https://www.tuolocale.it/logo.png"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ws-accent">Colore accento</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={accent}
                      onChange={(e) => patch({ portalAccent: e.target.value })}
                      className="h-9 w-12 cursor-pointer rounded border"
                    />
                    <Input
                      id="ws-accent"
                      value={accent}
                      onChange={(e) => patch({ portalAccent: e.target.value })}
                      maxLength={9}
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ws-welcome">Messaggio di benvenuto</Label>
                  <Textarea
                    id="ws-welcome"
                    rows={3}
                    value={welcome}
                    onChange={(e) => patch({ portalWelcome: e.target.value })}
                    maxLength={500}
                  />
                </div>
              </div>
            )}

            {step === "consent" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ws-legal">Informativa GDPR</Label>
                  <Textarea
                    id="ws-legal"
                    rows={6}
                    value={legal}
                    onChange={(e) => patch({ portalLegal: e.target.value })}
                    maxLength={2000}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Questo testo appare sotto il form. Verrà loggato come prova del consenso
                  insieme a IP, user-agent e timestamp dell&apos;ospite.
                </p>
              </div>
            )}

            {step === "coupon" && (
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={data.autoCouponEnabled}
                    onChange={(e) => patch({ autoCouponEnabled: e.target.checked })}
                  />
                  Emetti automaticamente un coupon di benvenuto
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="ws-pct">Percentuale sconto</Label>
                    <Input
                      id="ws-pct"
                      type="number"
                      min={1}
                      max={80}
                      value={data.autoCouponPercent}
                      onChange={(e) =>
                        patch({ autoCouponPercent: Number(e.target.value) })
                      }
                      disabled={!data.autoCouponEnabled}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ws-days">Validità (giorni)</Label>
                    <Input
                      id="ws-days"
                      type="number"
                      min={1}
                      max={365}
                      value={data.autoCouponDays}
                      onChange={(e) =>
                        patch({ autoCouponDays: Number(e.target.value) })
                      }
                      disabled={!data.autoCouponEnabled}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Salvando, viene creato/aggiornato un workflow di marketing automation
                  con trigger <code>WIFI_LEAD_CREATED</code>. Lo vedi nella sezione
                  Automazioni.
                </p>
              </div>
            )}

            {step === "qr" && (
              <div className="space-y-4">
                <div>
                  <Label className="text-xs">URL captive portal</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <Input value={captiveUrl} readOnly className="font-mono text-xs" />
                    <Button type="button" variant="outline" size="sm" onClick={() => copy(captiveUrl)}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  {qr.dataUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={qr.dataUrl}
                      alt="QR captive portal"
                      width={180}
                      height={180}
                      className="rounded-md border bg-white p-2"
                    />
                  )}
                  <div className="space-y-2 text-xs">
                    <p className="text-muted-foreground">
                      Stampa questo QR sul tavolo o sul volantino. Quando lo si scansiona, il
                      cliente atterra direttamente sul portale brandizzato.
                    </p>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={downloadSvg}>
                        <Download className="h-3.5 w-3.5" /> SVG
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={refreshQr}>
                        Rigenera
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Snippet pronti per il router</Label>
                  <p className="text-xs text-muted-foreground">
                    Copia/incolla nel pannello del controller. Funzionano in modalità
                    redirect (no PSK richiesto): il portale fa l&apos;autenticazione.
                  </p>
                  {snippets.map((s) => (
                    <details key={s.kind} className="rounded-md border">
                      <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm">
                        <span>{s.label}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault();
                            copy(s.code);
                          }}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </summary>
                      <pre className="overflow-x-auto bg-secondary px-3 py-2 text-[11px] leading-snug">
                        {s.code}
                      </pre>
                    </details>
                  ))}
                </div>
              </div>
            )}

            {step === "test" && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Generiamo un lead finto con consenso marketing per verificare che la pipeline
                  funzioni: lo vedrai apparire in <code>/wifi</code>, e se hai attivato il
                  coupon automatico ne troverai uno fresco in <code>/coupons</code>.
                </p>
                <Button type="button" variant="gold" onClick={runTest} disabled={busy}>
                  <PlayCircle className="h-4 w-4" /> Esegui test
                </Button>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
            {success && <p className="text-sm text-emerald-700">{success}</p>}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-3">
              <Button type="button" variant="ghost" onClick={back} disabled={stepIndex === 0}>
                <ChevronLeft className="h-4 w-4" /> Indietro
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => save()}
                  disabled={busy}
                >
                  Salva bozza
                </Button>
                {isLast ? (
                  <Button
                    type="button"
                    variant="gold"
                    onClick={() => save({ complete: true })}
                    disabled={busy}
                  >
                    <CheckCircle2 className="h-4 w-4" /> Completa
                  </Button>
                ) : (
                  <Button type="button" variant="gold" onClick={next} disabled={busy}>
                    Avanti <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Anteprima portale</CardTitle>
              <CardDescription>Esattamente quello che vedrà il cliente.</CardDescription>
            </CardHeader>
            <CardContent>
              <PortalPreview
                accent={accent}
                logoUrl={data.portalLogoUrl}
                welcome={welcome}
                legal={legal}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Stato setup</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <Row label="Brand" done={Boolean(data.portalLogoUrl || data.portalAccent || data.portalWelcome)} />
              <Row label="Consenso GDPR" done={Boolean(data.portalLegal)} />
              <Row label="Coupon automatico" done={data.autoCouponEnabled} />
              <Row label="Setup completato" done={Boolean(data.setupAt)} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-md border px-2 py-1">
      <span>{label}</span>
      <Badge tone={done ? "success" : "neutral"}>{done ? "ok" : "—"}</Badge>
    </div>
  );
}

function descriptionFor(step: StepId): string {
  switch (step) {
    case "brand":
      return "Logo, colore e benvenuto del portale che il cliente vede al primo collegamento.";
    case "consent":
      return "Testo legale GDPR mostrato sotto il form di registrazione.";
    case "coupon":
      return "Premia il primo collegamento con un coupon automatico (consigliato).";
    case "qr":
      return "Genera QR e snippet di config per UniFi/MikroTik/OpenWrt.";
    case "test":
      return "Simula un cliente reale per verificare la pipeline end-to-end.";
  }
}

function PortalPreview({
  accent,
  logoUrl,
  welcome,
  legal,
}: {
  accent: string;
  logoUrl: string | null;
  welcome: string;
  legal: string;
}) {
  const accentBg = useMemo(() => `${accent}1a`, [accent]);
  return (
    <div className="rounded-2xl border bg-background p-4 text-xs">
      <div className="flex flex-col items-center gap-2 text-center">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="Logo" className="h-10 w-10 rounded-md object-contain" />
        ) : (
          <span
            className="grid h-10 w-10 place-items-center rounded-full"
            style={{ background: accentBg, color: accent }}
          >
            <Wifi className="h-5 w-5" />
          </span>
        )}
        <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: accent }}>
          Wi-Fi gratuito
        </p>
        <p className="text-sm font-medium">Benvenuto</p>
        <p className="text-muted-foreground">{welcome}</p>
      </div>
      <div className="mt-3 space-y-2">
        <div className="h-7 rounded-md border bg-secondary/40" />
        <div className="h-7 rounded-md border bg-secondary/40" />
        <div className="h-7 rounded-md border bg-secondary/40" />
        <button
          type="button"
          className="h-9 w-full rounded-md text-xs font-semibold"
          style={{ background: accent, color: "#15161a" }}
        >
          Connettiti
        </button>
      </div>
      <p className="mt-3 text-[10px] text-muted-foreground">{legal}</p>
    </div>
  );
}
