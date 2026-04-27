import { notFound } from "next/navigation";
import Link from "next/link";
import {
  BookOpen,
  CalendarRange,
  MapPin,
  MessagesSquare,
  Phone,
  Star,
  Wifi,
} from "lucide-react";
import { dayLabel, getVenueHub } from "@/server/venue-hub";
import { PublicFootnote, PublicHeader } from "@/components/branding/public-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const PLATFORM_LABEL: Record<string, string> = {
  GOOGLE: "Google",
  TRIPADVISOR: "TripAdvisor",
  TRUSTPILOT: "Trustpilot",
  THEFORK: "TheFork",
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  YELP: "Yelp",
  OTHER: "Altro",
};

export default async function VenueHubPage({
  params,
}: {
  params: { slug: string };
}) {
  const hub = await getVenueHub(params.slug);
  if (!hub) notFound();

  const brand = {
    name: hub.name,
    city: hub.city,
    logoUrl: hub.brand.logoUrl,
    accent: hub.brand.accent,
    footnote: hub.brand.footnote,
  };
  const accent = hub.brand.accent;
  const accentSoft = `${accent}1a`;
  const todayWeekday = new Date().getDay();
  const todayHours = hub.hours.find((h) => h.weekday === todayWeekday);

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-2xl flex-col gap-6 px-4 py-8">
      <PublicHeader brand={brand} kicker={hub.kind === "BEACH_CLUB" ? "Beach club" : "Ristorante"} />

      <section className="space-y-3">
        <h1 className="text-display text-4xl leading-tight md:text-5xl">{hub.name}</h1>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {(hub.address || hub.city) && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" style={{ color: accent }} />
              {[hub.address, hub.city].filter(Boolean).join(" · ")}
            </span>
          )}
          {hub.phone && (
            <a
              href={`tel:${hub.phone.replace(/\s/g, "")}`}
              className="inline-flex items-center gap-1.5 hover:text-foreground"
            >
              <Phone className="h-3.5 w-3.5" style={{ color: accent }} /> {hub.phone}
            </a>
          )}
          {hub.reviewSummary.count > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <Star className="h-3.5 w-3.5 fill-current" style={{ color: accent }} />
              {hub.reviewSummary.average.toFixed(1)}
              <span className="text-muted-foreground">
                ({hub.reviewSummary.count})
              </span>
            </span>
          )}
        </div>
        {todayHours && (
          <p className="text-xs text-muted-foreground">
            <strong style={{ color: accent }}>Oggi</strong>:{" "}
            {todayHours.ranges
              .map((r) => `${r.name} ${r.from}–${r.to}`)
              .join(" · ")}
          </p>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <ActionCard
          href={`/b/${hub.slug}`}
          icon={CalendarRange}
          title="Prenota un tavolo"
          description="Scegli giorno e orario. Conferma in 30 secondi."
          accent={accent}
        />
        {hub.hasMenu && (
          <ActionCard
            href={`/m/${hub.slug}`}
            icon={BookOpen}
            title="Vedi il menu"
            description="Carta, allergeni e piatti del giorno."
            accent={accent}
          />
        )}
        <ActionCard
          href={`/chat/${hub.slug}`}
          icon={MessagesSquare}
          title="Chatta con noi"
          description="Domande veloci, prenota in chat 24/7."
          accent={accent}
        />
        <ActionCard
          href={`/wifi/${hub.slug}`}
          icon={Wifi}
          title="Wi-Fi gratuito"
          description="Connettiti in 1 click. Niente spam."
          accent={accent}
        />
      </section>

      {hub.recentReviews.length > 0 && (
        <Card>
          <CardContent className="space-y-3 py-4 text-sm">
            <div className="flex items-center justify-between">
              <p className="font-medium">Cosa dicono di noi</p>
              <span
                className="inline-flex items-center gap-1 text-xs"
                style={{ color: accent }}
              >
                <Star className="h-3.5 w-3.5 fill-current" />
                {hub.reviewSummary.average.toFixed(1)} / 5
              </span>
            </div>
            <ul className="space-y-2">
              {hub.recentReviews.map((r) => (
                <li
                  key={r.id}
                  className="rounded-md border bg-secondary/30 p-3 text-xs"
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-medium">{r.authorName ?? "Anonimo"}</span>
                    <Badge tone="neutral">{r.source}</Badge>
                    <span style={{ color: accent }}>
                      {"★".repeat(r.rating)}
                      {"☆".repeat(Math.max(0, 5 - r.rating))}
                    </span>
                  </div>
                  <p className="line-clamp-3 text-muted-foreground">{r.text}</p>
                </li>
              ))}
            </ul>
            {hub.reviewLinks.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {hub.reviewLinks.map((rl) => (
                  <a
                    key={rl.id}
                    href={`/r/${rl.id}`}
                    target="_blank"
                    rel="noopener"
                    className="rounded-full border px-3 py-1 text-xs hover:bg-secondary"
                    style={{ borderColor: `${accent}55` }}
                  >
                    {rl.label ?? PLATFORM_LABEL[rl.platform] ?? rl.platform}
                  </a>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {hub.hours.length > 0 && (
        <Card>
          <CardContent className="space-y-2 py-4 text-sm">
            <p className="font-medium">Orari di apertura</p>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {hub.hours.map((h) => (
                <li
                  key={h.weekday}
                  className={
                    h.weekday === todayWeekday ? "font-medium text-foreground" : ""
                  }
                  style={
                    h.weekday === todayWeekday
                      ? { background: accentSoft, padding: "4px 8px", borderRadius: 6 }
                      : undefined
                  }
                >
                  {dayLabel(h.weekday)} ·{" "}
                  {h.ranges
                    .map((r) => `${r.name.toLowerCase()} ${r.from}–${r.to}`)
                    .join(" · ")}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <PublicFootnote brand={brand} />
    </div>
  );
}

function ActionCard({
  href,
  icon: Icon,
  title,
  description,
  accent,
}: {
  href: string;
  icon: typeof CalendarRange;
  title: string;
  description: string;
  accent: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-xl border bg-background p-4 transition-colors hover:bg-secondary/40"
    >
      <span
        className="grid h-10 w-10 flex-none place-items-center rounded-lg"
        style={{ background: `${accent}1a`, color: accent }}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <p className="font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </span>
    </Link>
  );
}
