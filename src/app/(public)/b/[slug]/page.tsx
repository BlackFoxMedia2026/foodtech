import { notFound } from "next/navigation";
import { MapPin, Phone } from "lucide-react";
import { getPublicVenue } from "@/server/widget";
import { WidgetForm } from "@/components/widget/widget-form";
import { LocaleSwitch } from "@/components/widget/locale-switch";
import { isStripeEnabled } from "@/lib/stripe";
import { formatCurrency } from "@/lib/utils";
import { dict, pickLocale, t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function PublicBookingPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { lang?: string };
}) {
  const venue = await getPublicVenue(params.slug);
  if (!venue) notFound();
  const locale = pickLocale(searchParams.lang);
  const d = dict(locale);

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-carbon-800 text-sand-50 font-display text-xs">
            T
          </span>
          <span>{d["widget.brand"]}</span>
        </div>
        <LocaleSwitch locale={locale} />
      </header>

      <section className="space-y-3">
        <p className="text-xs uppercase tracking-[0.18em] text-gilt-dark">
          {t(locale, `widget.kind.${venue.kind}` as keyof typeof d, undefined) || t(locale, "widget.kind.OTHER")}
        </p>
        <h1 className="text-display text-4xl leading-tight md:text-5xl">{venue.name}</h1>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {venue.city && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> {[venue.address, venue.city].filter(Boolean).join(" · ")}
            </span>
          )}
          {venue.phone && (
            <span className="inline-flex items-center gap-1">
              <Phone className="h-3.5 w-3.5" /> {venue.phone}
            </span>
          )}
        </div>
      </section>

      <WidgetForm
        slug={venue.slug}
        venueName={venue.name}
        currency={venue.currency}
        depositThreshold={venue.depositThreshold}
        depositPerPersonCents={venue.depositPerPersonCents}
        depositActive={isStripeEnabled()}
        locale={locale}
      />

      {isStripeEnabled() && (
        <p className="-mt-4 text-xs text-muted-foreground">
          {t(locale, "widget.deposit.foot", {
            threshold: venue.depositThreshold,
            each: formatCurrency(venue.depositPerPersonCents, venue.currency),
          })}
        </p>
      )}

      <footer className="mt-auto pt-8 text-xs text-muted-foreground">
        {d["widget.poweredBy"]} <span className="font-medium text-foreground">Tavolo</span> · {d["widget.secureBooking"]}
      </footer>
    </div>
  );
}
