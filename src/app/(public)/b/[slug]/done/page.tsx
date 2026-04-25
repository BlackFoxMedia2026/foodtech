import Link from "next/link";
import { CheckCircle2, CalendarClock, Users, AlertTriangle, CreditCard } from "lucide-react";
import { notFound } from "next/navigation";
import { getBookingByReference, getPublicVenue } from "@/server/widget";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LocaleSwitch } from "@/components/widget/locale-switch";
import { pickLocale, t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function BookingConfirmationPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { ref?: string; paid?: string; lang?: string };
}) {
  const ref = searchParams.ref;
  if (!ref) notFound();
  const locale = pickLocale(searchParams.lang);

  const venue = await getPublicVenue(params.slug);
  if (!venue) notFound();

  const booking = await getBookingByReference(params.slug, ref);
  if (!booking) notFound();

  const guestName = booking.guest
    ? [booking.guest.firstName, booking.guest.lastName].filter(Boolean).join(" ")
    : "guest";
  const firstName = guestName.split(" ")[0];

  const paidParam = searchParams.paid;
  const paymentFailed = paidParam === "0" || booking.depositStatus === "FAILED";
  const paymentHeld = paidParam === "1" || booking.depositStatus === "HELD" || booking.depositStatus === "CAPTURED";

  const eyebrow = paymentFailed
    ? t(locale, "done.failed")
    : paymentHeld
      ? t(locale, "done.confirmed")
      : t(locale, "done.requestSent");

  const headline = paymentFailed
    ? t(locale, "done.headline.failed")
    : paymentHeld
      ? t(locale, "done.headline.held", { first: firstName })
      : t(locale, "done.headline.requested", { first: firstName });

  const subhead = paymentFailed
    ? t(locale, "done.sub.failed")
    : paymentHeld
      ? t(locale, "done.sub.held", { venue: venue.name })
      : t(locale, "done.sub.requested", { venue: venue.name });

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col px-6 py-10">
      <header className="flex justify-end">
        <LocaleSwitch locale={locale} />
      </header>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <span
          className={
            paymentFailed
              ? "grid h-14 w-14 place-items-center rounded-full bg-rose-100 text-rose-600"
              : "grid h-14 w-14 place-items-center rounded-full bg-gilt/15 text-gilt-dark"
          }
        >
          {paymentFailed ? <AlertTriangle className="h-7 w-7" /> : <CheckCircle2 className="h-7 w-7" />}
        </span>
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.18em] text-gilt-dark">{eyebrow}</p>
          <h1 className="text-display text-3xl leading-tight md:text-4xl">{headline}</h1>
          <p className="text-sm text-muted-foreground">{subhead}</p>
        </div>

        <div className="w-full rounded-lg border bg-background p-4 text-sm">
          <div className="flex items-center justify-between border-b py-2">
            <span className="text-muted-foreground">{t(locale, "done.code")}</span>
            <span className="font-mono text-xs">{booking.reference.slice(-8).toUpperCase()}</span>
          </div>
          <div className="flex items-center justify-between border-b py-2">
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5" /> {t(locale, "done.when")}
            </span>
            <span>{formatDateTime(booking.startsAt, locale === "it" ? "it-IT" : "en-GB")}</span>
          </div>
          <div className="flex items-center justify-between border-b py-2">
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <Users className="h-3.5 w-3.5" /> {t(locale, "done.party")}
            </span>
            <span>{booking.partySize}</span>
          </div>
          {booking.depositCents > 0 && (
            <div className="flex items-center justify-between py-2">
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <CreditCard className="h-3.5 w-3.5" /> {t(locale, "done.deposit")}
              </span>
              <span className={paymentHeld ? "text-emerald-600" : paymentFailed ? "text-rose-600" : ""}>
                {formatCurrency(booking.depositCents, venue.currency)}{" "}
                {paymentHeld ? `· ${t(locale, "done.depositHeld")}` : paymentFailed ? `· ${t(locale, "done.depositFailed")}` : ""}
              </span>
            </div>
          )}
        </div>

        <Button asChild variant="outline">
          <Link href={`/b/${params.slug}?lang=${locale}`}>{t(locale, "done.newBooking")}</Link>
        </Button>
      </div>
    </div>
  );
}
