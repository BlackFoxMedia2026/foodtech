import { notFound } from "next/navigation";
import { MapPin, Phone } from "lucide-react";
import { getPublicVenue } from "@/server/widget";
import { WidgetForm } from "@/components/widget/widget-form";

export const dynamic = "force-dynamic";

export default async function PublicBookingPage({ params }: { params: { slug: string } }) {
  const venue = await getPublicVenue(params.slug);
  if (!venue) notFound();

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-carbon-800 text-sand-50 font-display text-xs">
          T
        </span>
        <span>Tavolo · prenotazione online</span>
      </header>

      <section className="space-y-3">
        <p className="text-xs uppercase tracking-[0.18em] text-gilt-dark">
          {kindLabel(venue.kind)}
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

      <WidgetForm slug={venue.slug} venueName={venue.name} />

      <footer className="mt-auto pt-8 text-xs text-muted-foreground">
        Powered by <span className="font-medium text-foreground">Tavolo</span> · prenotazione sicura
      </footer>
    </div>
  );
}

function kindLabel(kind: string) {
  switch (kind) {
    case "RESTAURANT":
      return "Ristorante";
    case "BEACH_CLUB":
      return "Beach club";
    case "BAR":
      return "Bar / cocktail";
    case "HOTEL_RESTAURANT":
      return "Hotel restaurant";
    case "PRIVATE_CLUB":
      return "Private club";
    default:
      return "Locale";
  }
}
