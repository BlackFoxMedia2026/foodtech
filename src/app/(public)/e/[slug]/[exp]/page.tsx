import { notFound } from "next/navigation";
import { CalendarClock, MapPin, Users } from "lucide-react";
import { getPublishedExperience } from "@/server/tickets";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { TicketForm } from "@/components/widget/ticket-form";

export const dynamic = "force-dynamic";

export default async function PublicExperiencePage({
  params,
  searchParams,
}: {
  params: { slug: string; exp: string };
  searchParams: { canceled?: string };
}) {
  const ctx = await getPublishedExperience(params.slug, params.exp);
  if (!ctx) notFound();
  const { venue, experience, soldQuantity } = ctx;
  const remaining = Math.max(0, experience.capacity - soldQuantity);
  const past = new Date(experience.endsAt) < new Date();

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-carbon-800 text-sand-50 font-display text-xs">
          T
        </span>
        <span>Tavolo · esperienze</span>
      </header>

      {experience.coverImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={experience.coverImage}
          alt={experience.title}
          className="aspect-[16/7] w-full rounded-xl object-cover"
        />
      )}

      <section className="space-y-3">
        <p className="text-xs uppercase tracking-[0.18em] text-gilt-dark">{venue.name}</p>
        <h1 className="text-display text-4xl leading-tight md:text-5xl">{experience.title}</h1>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="h-3.5 w-3.5" /> {formatDateTime(experience.startsAt)} — {formatDateTime(experience.endsAt)}
          </span>
          {venue.city && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> {[venue.address, venue.city].filter(Boolean).join(" · ")}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" /> {remaining} posti disponibili
          </span>
        </div>
        {experience.description && (
          <p className="whitespace-pre-line text-base leading-relaxed text-foreground/80">
            {experience.description}
          </p>
        )}
      </section>

      {searchParams.canceled === "1" && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Pagamento annullato. Puoi riprovare quando vuoi.
        </p>
      )}

      {past ? (
        <p className="rounded-md border bg-secondary px-3 py-2 text-sm text-muted-foreground">
          L&apos;evento è terminato.
        </p>
      ) : remaining === 0 ? (
        <p className="rounded-md border bg-secondary px-3 py-2 text-sm text-muted-foreground">
          Sold out — al completo.
        </p>
      ) : (
        <TicketForm
          slug={venue.slug}
          experienceSlug={experience.slug}
          priceCents={experience.priceCents}
          currency={venue.currency}
          maxPerOrder={Math.min(10, remaining)}
        />
      )}

      <footer className="mt-auto pt-8 text-xs text-muted-foreground">
        Powered by <span className="font-medium text-foreground">Tavolo</span>
        {experience.priceCents > 0 && " · pagamento sicuro via Stripe"}
      </footer>
    </div>
  );
}
