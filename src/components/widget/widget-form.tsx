"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, formatCurrency } from "@/lib/utils";
import { type Locale, t } from "@/lib/i18n";

type Slot = { time: string; available: boolean };

export function WidgetForm({
  slug,
  venueName,
  currency,
  depositThreshold,
  depositPerPersonCents,
  depositActive,
  locale,
}: {
  slug: string;
  venueName: string;
  currency: string;
  depositThreshold: number;
  depositPerPersonCents: number;
  depositActive: boolean;
  locale: Locale;
}) {
  const router = useRouter();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [step, setStep] = useState<1 | 2>(1);
  const [date, setDate] = useState(today);
  const [partySize, setPartySize] = useState(2);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [time, setTime] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingSlots(true);
    setTime(null);
    const url = `/api/widget/${slug}/slots?date=${date}&partySize=${partySize}`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setSlots(Array.isArray(data?.slots) ? data.slots : []);
      })
      .catch(() => {
        if (!cancelled) setSlots([]);
      })
      .finally(() => !cancelled && setLoadingSlots(false));
    return () => {
      cancelled = true;
    };
  }, [slug, date, partySize]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!time) return;
    setSubmitting(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      partySize,
      date,
      time,
      firstName: String(fd.get("firstName") ?? "").trim(),
      lastName: String(fd.get("lastName") ?? "").trim() || null,
      email: String(fd.get("email") ?? "").trim(),
      phone: String(fd.get("phone") ?? "").trim(),
      occasion: (fd.get("occasion") as string) || null,
      notes: String(fd.get("notes") ?? "").trim() || null,
      marketingOptIn: fd.get("marketingOptIn") === "on",
    };

    const res = await fetch(`/api/widget/${slug}`, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "content-type": "application/json" },
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const code = (body?.error as string) ?? "generic";
      const key = `widget.error.${code}` as `widget.error.${string}`;
      const fallback = t(locale, "widget.error.generic");
      const msg = t(locale, key as never) || fallback;
      setError(msg);
      if (code === "slot_unavailable") setStep(1);
      return;
    }
    const { reference, checkoutUrl } = await res.json();
    if (checkoutUrl) {
      window.location.assign(checkoutUrl);
      return;
    }
    router.push(`/b/${slug}/done?ref=${reference}&lang=${locale}`);
  }

  const availableSlots = slots.filter((s) => s.available);
  const summary = t(locale, "widget.summary", {
    venue: venueName,
    date,
    time: time ?? "",
    party: String(partySize),
  })
    .split(/(\{venue\}|\{date\}|\{time\}|\{party\})/)
    .map((piece) => piece);
  void summary;

  return (
    <Card className="border-foreground/10">
      <CardContent className="p-6 md:p-8">
        {step === 1 ? (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="party">{t(locale, "widget.party")}</Label>
                <Select value={String(partySize)} onValueChange={(v) => setPartySize(Number(v))}>
                  <SelectTrigger id="party">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }).map((_, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>
                        {i + 1}{" "}
                        {i === 0
                          ? t(locale, "widget.party.singular")
                          : t(locale, "widget.party.plural")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="date">{t(locale, "widget.date")}</Label>
                <Input
                  id="date"
                  type="date"
                  min={today}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t(locale, "widget.time")}</Label>
              {loadingSlots ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t(locale, "widget.loadingSlots")}
                </div>
              ) : availableSlots.length === 0 ? (
                <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                  {t(locale, "widget.noSlots")}
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {slots.map((s) => (
                    <button
                      key={s.time}
                      type="button"
                      disabled={!s.available}
                      onClick={() => {
                        setTime(s.time);
                        setStep(2);
                      }}
                      className={cn(
                        "rounded-md border px-2 py-2 text-sm transition",
                        s.available
                          ? "hover:border-gilt hover:bg-gilt/10"
                          : "cursor-not-allowed border-dashed text-muted-foreground/50",
                        time === s.time && "border-gilt bg-gilt/15",
                      )}
                    >
                      {s.time}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="rounded-md bg-secondary px-3 py-2 text-xs text-muted-foreground">
              {t(locale, "widget.summary", {
                venue: venueName,
                date,
                time: time ?? "",
                party: String(partySize),
              })}{" "}
              <button
                type="button"
                onClick={() => setStep(1)}
                className="ml-1 underline-offset-2 hover:underline"
              >
                {t(locale, "widget.modify")}
              </button>
            </div>

            {depositActive && partySize >= depositThreshold && (
              <div className="flex items-start gap-3 rounded-md border border-gilt/40 bg-gilt/5 px-3 py-3 text-sm">
                <span className="mt-0.5 text-gilt-dark">💳</span>
                <div>
                  <p className="font-medium">{t(locale, "widget.deposit.title")}</p>
                  <p className="text-xs text-muted-foreground">
                    {t(locale, "widget.deposit.copy", {
                      threshold: depositThreshold,
                      total: formatCurrency(depositPerPersonCents * partySize, currency),
                      each: formatCurrency(depositPerPersonCents, currency),
                    })}
                  </p>
                </div>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">{t(locale, "widget.firstName")}</Label>
                <Input id="firstName" name="firstName" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">{t(locale, "widget.lastName")}</Label>
                <Input id="lastName" name="lastName" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">{t(locale, "widget.email")}</Label>
                <Input id="email" name="email" type="email" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">{t(locale, "widget.phone")}</Label>
                <Input id="phone" name="phone" required placeholder="+39 …" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="occasion">{t(locale, "widget.occasion")}</Label>
              <Select name="occasion">
                <SelectTrigger id="occasion">
                  <SelectValue placeholder={t(locale, "widget.occasion.none")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BIRTHDAY">{t(locale, "widget.occasion.BIRTHDAY")}</SelectItem>
                  <SelectItem value="ANNIVERSARY">{t(locale, "widget.occasion.ANNIVERSARY")}</SelectItem>
                  <SelectItem value="BUSINESS">{t(locale, "widget.occasion.BUSINESS")}</SelectItem>
                  <SelectItem value="DATE">{t(locale, "widget.occasion.DATE")}</SelectItem>
                  <SelectItem value="CELEBRATION">{t(locale, "widget.occasion.CELEBRATION")}</SelectItem>
                  <SelectItem value="OTHER">{t(locale, "widget.occasion.OTHER")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">{t(locale, "widget.notes")}</Label>
              <Textarea id="notes" name="notes" rows={3} />
            </div>

            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                name="marketingOptIn"
                className="mt-0.5 h-3.5 w-3.5 rounded border-input"
              />
              {t(locale, "widget.optIn", { venue: venueName })}
            </label>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setStep(1)}>
                {t(locale, "widget.back")}
              </Button>
              <Button type="submit" variant="gold" disabled={submitting}>
                {submitting
                  ? t(locale, "widget.submitting")
                  : depositActive && partySize >= depositThreshold
                    ? t(locale, "widget.submit.deposit", {
                        amount: formatCurrency(depositPerPersonCents * partySize, currency),
                      })
                    : t(locale, "widget.submit")}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
