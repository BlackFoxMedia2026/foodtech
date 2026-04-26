"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const SCORES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

type ReviewLink = { id: string; platform: string; label: string | null; url: string };

const PLATFORM_LABEL: Record<string, string> = {
  GOOGLE: "Google",
  TRIPADVISOR: "TripAdvisor",
  TRUSTPILOT: "Trustpilot",
  THEFORK: "TheFork",
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  YELP: "Yelp",
  OTHER: "Recensione",
};

export function SurveyForm({
  token,
  reviewLinks,
}: {
  token: string;
  reviewLinks: ReviewLink[];
}) {
  const router = useRouter();
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"form" | "thanks">("form");
  const [submittedScore, setSubmittedScore] = useState<number | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (score === null) {
      setError("Seleziona un punteggio.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/surveys/${token}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        npsScore: score,
        comment: comment.trim() || null,
        recommend: score >= 9,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(
        b?.error === "already_submitted"
          ? "Hai già risposto, grazie."
          : "Invio non riuscito.",
      );
      return;
    }
    setSubmittedScore(score);
    setStep("thanks");
    // Refresh in background to avoid double-submit if the user revisits
    setTimeout(() => router.refresh(), 1500);
  }

  const tone = (n: number) =>
    n >= 9 ? "promoter" : n >= 7 ? "passive" : "detractor";

  if (step === "thanks") {
    const isPromoter = (submittedScore ?? 0) >= 9;
    return (
      <Card className="border-emerald-200 bg-emerald-50/40">
        <CardContent className="space-y-4 p-6 text-center">
          <h2 className="text-display text-2xl">Grazie!</h2>
          <p className="text-sm text-muted-foreground">
            La tua opinione conta davvero per noi.
          </p>
          {isPromoter && reviewLinks.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium">
                Se ti è piaciuto, ci aiuti con una recensione pubblica?
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {reviewLinks.map((rl) => (
                  <a
                    key={rl.id}
                    href={`/api/r/${rl.id}?survey=${token}&nps=${submittedScore ?? ""}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border border-gilt/40 bg-background px-4 py-2 text-sm hover:bg-gilt/10"
                  >
                    {rl.label ?? PLATFORM_LABEL[rl.platform] ?? rl.platform}
                  </a>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Apriamo la pagina della piattaforma in una nuova scheda.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-foreground/10">
      <CardContent className="p-6 md:p-8">
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label>Quanto ci consigli a un amico?</Label>
            <div className="grid grid-cols-11 gap-1">
              {SCORES.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setScore(n)}
                  className={cn(
                    "rounded-md border py-2 text-center text-sm transition",
                    score === n
                      ? tone(n) === "promoter"
                        ? "border-emerald-400 bg-emerald-50 text-emerald-800"
                        : tone(n) === "passive"
                          ? "border-amber-400 bg-amber-50 text-amber-800"
                          : "border-rose-400 bg-rose-50 text-rose-800"
                      : "border-border hover:bg-secondary",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
              <span>Per niente</span>
              <span>Tantissimo</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="s-comment">
              {score !== null && score < 7
                ? "Cosa ti è mancato? Resta tra te e noi."
                : "Vuoi aggiungere un commento?"}
            </Label>
            <Textarea
              id="s-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={5}
              placeholder={
                score !== null && score < 7
                  ? "Le tue parole arrivano direttamente al manager del locale."
                  : "Cosa ti è piaciuto? Cosa miglioreresti?"
              }
            />
            {score !== null && score < 7 && (
              <p className="text-[11px] text-muted-foreground">
                Questo feedback non viene pubblicato online.
              </p>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" variant="gold" disabled={busy} className="w-full">
            {busy ? "Invio…" : "Invia feedback"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
