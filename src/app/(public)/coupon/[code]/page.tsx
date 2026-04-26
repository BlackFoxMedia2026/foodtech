import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, CalendarClock, Gift, Tag } from "lucide-react";
import { validateCouponCode } from "@/server/coupons";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const KIND_ICON = {
  PERCENT: Tag,
  FIXED: Tag,
  FREE_ITEM: Gift,
  MENU_OFFER: Gift,
} as const;

const REASON_MSG: Record<string, string> = {
  not_found: "Codice non valido o inesistente.",
  expired: "Coupon scaduto.",
  not_yet_valid: "Coupon non ancora attivo.",
  exhausted: "Coupon esaurito.",
  guest_exhausted: "Hai già utilizzato questo coupon il numero massimo di volte.",
  wrong_guest: "Coupon non valido per questo account.",
  paused: "Coupon temporaneamente sospeso.",
  archived: "Coupon archiviato.",
};

export default async function CouponLandingPage({ params }: { params: { code: string } }) {
  if (!params.code) notFound();
  const result = await validateCouponCode(decodeURIComponent(params.code));

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-6 py-10 text-center">
      <header className="self-start text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-carbon-800 text-sand-50 font-display text-xs">
            T
          </span>
          Tavolo · coupon
        </span>
      </header>

      {result.ok ? (
        <Valid result={result} />
      ) : (
        <Invalid reason={result.reason} />
      )}

      <footer className="mt-auto pt-8 text-[10px] text-muted-foreground">
        Mostra il codice allo staff per riscattarlo. Coupon non cumulabile salvo diversa indicazione.
      </footer>
    </div>
  );
}

function Valid({ result }: { result: Extract<Awaited<ReturnType<typeof validateCouponCode>>, { ok: true }> }) {
  const Icon = KIND_ICON[result.coupon.kind] ?? Tag;
  const valueLabel =
    result.coupon.kind === "PERCENT"
      ? `${result.coupon.value}%`
      : result.coupon.kind === "FIXED"
        ? formatCurrency(result.coupon.value, result.venue.currency)
        : result.coupon.kind === "FREE_ITEM"
          ? result.coupon.freeItem ?? "Omaggio"
          : "Menu offer";
  return (
    <>
      <span className="grid h-14 w-14 place-items-center rounded-full bg-gilt/15 text-gilt-dark">
        <Icon className="h-7 w-7" />
      </span>
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-[0.18em] text-gilt-dark">Coupon valido</p>
        <h1 className="text-display text-3xl">{result.coupon.name}</h1>
        <p className="text-sm text-muted-foreground">{result.venue.name}</p>
      </div>

      <div className="rounded-2xl border bg-background px-8 py-6 shadow-sm">
        <p className="text-display text-5xl text-gilt-dark">{valueLabel}</p>
        <p className="mt-2 font-mono text-xs uppercase tracking-widest">{result.coupon.code}</p>
      </div>

      {result.coupon.description && (
        <p className="text-sm text-foreground/80">{result.coupon.description}</p>
      )}

      {result.coupon.validUntil && (
        <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarClock className="h-3.5 w-3.5" /> Scade il {formatDate(result.coupon.validUntil)}
        </p>
      )}

      <Link
        href={`/b/${result.venue.slug}`}
        className="rounded-md bg-gilt px-4 py-2 text-sm font-medium text-carbon-900 hover:bg-gilt-light"
      >
        Prenota subito da {result.venue.name}
      </Link>
    </>
  );
}

function Invalid({ reason }: { reason: string }) {
  return (
    <>
      <span className="grid h-14 w-14 place-items-center rounded-full bg-rose-100 text-rose-600">
        <AlertTriangle className="h-7 w-7" />
      </span>
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-[0.18em] text-rose-600">Coupon non utilizzabile</p>
        <h1 className="text-display text-2xl">{REASON_MSG[reason] ?? "Coupon non valido."}</h1>
      </div>
    </>
  );
}
