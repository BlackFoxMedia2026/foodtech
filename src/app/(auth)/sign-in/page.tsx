"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.12c-.22-.66-.35-1.36-.35-2.12s.13-1.46.35-2.12V7.04H2.18A10.99 10.99 0 0 0 1 12c0 1.77.42 3.45 1.18 4.96l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.04l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}

function SignInForm() {
  const router = useRouter();
  const search = useSearchParams();
  const { toast } = useToast();
  const callback = search.get("callbackUrl") ?? "/overview";
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Step 2FA: dopo che la prima signIn restituisce "2fa_required" passiamo a
  // step="totp" mantenendo email/password per il second pass.
  const [step, setStep] = useState<"credentials" | "totp">("credentials");
  const [creds, setCreds] = useState<{ email: string; password: string }>({
    email: "",
    password: "",
  });
  const [totpCode, setTotpCode] = useState("");

  async function submitCredentials(
    email: string,
    password: string,
    totp?: string,
  ) {
    setError(null);
    setLoading(true);
    const res = await signIn("credentials", {
      email,
      password,
      ...(totp ? { totpCode: totp } : {}),
      redirect: false,
    });
    setLoading(false);
    if (res?.error === "2fa_required") {
      setCreds({ email, password });
      setStep("totp");
      return;
    }
    if (res?.error === "2fa_invalid") {
      setError("Codice 2FA errato. Riprova.");
      toast.error("Codice 2FA errato");
      return;
    }
    if (res?.error) {
      setError("Credenziali non valide.");
      return;
    }
    router.push(callback);
    router.refresh();
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await submitCredentials(String(fd.get("email")), String(fd.get("password")));
  }

  async function onSubmitTotp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await submitCredentials(creds.email, creds.password, totpCode.trim());
  }

  async function onGoogle() {
    setGoogleLoading(true);
    try {
      // Se Google non è configurato lato server, NextAuth devierà su
      // /api/auth/error?error=Configuration. Catch del redirect non è
      // possibile da client; mostriamo il toast preventivamente solo se
      // l'errore arriva con redirect=false. Manteniamo redirect=true per
      // semplicità (UX standard NextAuth) e via fallback toast in caso di
      // errore visibile.
      const res = await signIn("google", { callbackUrl: callback, redirect: false });
      if (res?.error) {
        toast.error(
          "Accesso con Google non disponibile",
          "Il provider non è configurato su questo ambiente.",
        );
        setGoogleLoading(false);
        return;
      }
      if (res?.url) {
        window.location.href = res.url;
      }
    } catch {
      toast.error("Accesso con Google non disponibile");
      setGoogleLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-carbon-800 p-10 text-sand-50 lg:flex">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-gilt text-carbon-900 font-display font-semibold">T</span>
          <span className="text-display text-lg">Tavolo</span>
        </div>
        <div className="max-w-md space-y-4">
          <p className="text-display text-3xl leading-tight">
            Una sala perfetta è prima di tutto una <span className="text-gilt-light">questione di ritmo</span>.
          </p>
          <p className="text-sm text-sand-200/80">
            Tavolo coordina prenotazioni, sala, ospiti ed esperienze in un&apos;unica
            interfaccia pensata per chi accoglie ogni giorno.
          </p>
        </div>
        <p className="text-xs text-sand-200/60">© Tavolo · gestionale ospitalità</p>
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        {step === "credentials" ? (
          <div className="w-full max-w-sm space-y-6">
            <form onSubmit={onSubmit} className="space-y-6">
              <div className="space-y-2">
                <h1 className="text-display text-2xl">Accedi</h1>
                <p className="text-sm text-muted-foreground">
                  Demo: <code>owner@tavolo.demo</code> · <code>tavolo2026</code>
                </p>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" required defaultValue="owner@tavolo.demo" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" name="password" type="password" required defaultValue="tavolo2026" />
                </div>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Accesso in corso…" : "Entra in Tavolo"}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">oppure</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={onGoogle}
              disabled={googleLoading}
            >
              <GoogleIcon className="h-4 w-4" />
              {googleLoading ? "Reindirizzamento…" : "Accedi con Google"}
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmitTotp} className="w-full max-w-sm space-y-6">
            <div className="space-y-2">
              <h1 className="text-display text-2xl">Verifica 2FA</h1>
              <p className="text-sm text-muted-foreground">
                Inserisci il codice a 6 cifre generato dalla tua app di autenticazione.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="totp">Codice 2FA</Label>
              <Input
                id="totp"
                name="totp"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                autoFocus
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                onClick={() => {
                  setStep("credentials");
                  setTotpCode("");
                  setError(null);
                }}
              >
                Indietro
              </Button>
              <Button type="submit" className="flex-1" disabled={loading || totpCode.length !== 6}>
                {loading ? "Verifica…" : "Verifica"}
              </Button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
