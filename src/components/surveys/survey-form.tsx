"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const SCORES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function SurveyForm({ token }: { token: string }) {
  const router = useRouter();
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    router.refresh();
  }

  const tone = (n: number) =>
    n >= 9 ? "promoter" : n >= 7 ? "passive" : "detractor";

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
            <Label htmlFor="s-comment">Vuoi aggiungere un commento?</Label>
            <Textarea
              id="s-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={5}
              placeholder="Cosa ti è piaciuto? Cosa miglioreresti?"
            />
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
