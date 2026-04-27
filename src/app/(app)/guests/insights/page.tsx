import Link from "next/link";
import {
  AlertTriangle,
  Cake,
  Crown,
  Flame,
  Repeat,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { getActiveVenue } from "@/lib/tenant";
import { getSegmentInsights, type GuestSummary } from "@/server/guest-insights";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/overview/stat-card";
import { LoyaltyPill } from "@/components/guests/loyalty-pill";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

function daysSince(d: Date | null): number | null {
  if (!d) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400_000);
}

function nextBirthdayInDays(d: Date | null): number | null {
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const next = new Date(d);
  next.setFullYear(today.getFullYear());
  next.setHours(0, 0, 0, 0);
  if (next < today) next.setFullYear(today.getFullYear() + 1);
  return Math.round((next.getTime() - today.getTime()) / 86400_000);
}

export default async function GuestInsightsPage() {
  const ctx = await getActiveVenue();
  const insights = await getSegmentInsights(ctx.venueId);

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">CRM</p>
          <h1 className="flex items-center gap-2 text-display text-3xl">
            <Sparkles className="h-7 w-7 text-gilt-dark" /> Smart insights
          </h1>
          <p className="text-sm text-muted-foreground">
            Marketing proattivo: chi compie gli anni a breve, chi non torna da troppo,
            chi arriva oggi che merita un&apos;attenzione speciale.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/guests">← Torna agli ospiti</Link>
        </Button>
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        <StatCard
          label="Compleanni oggi"
          value={String(insights.birthdaysToday.length)}
          emphasize
        />
        <StatCard
          label="Compleanni 7gg"
          value={String(insights.birthdaysWeek.length)}
        />
        <StatCard label="VIP oggi" value={String(insights.vipsArrivingToday.length)} />
        <StatCard label="A rischio" value={String(insights.atRisk.length)} />
      </section>

      <Section
        title="Compleanni di oggi"
        description="Ricorda allo staff. Sing happy birthday e magari un calice offerto."
        icon={Cake}
        items={insights.birthdaysToday}
        empty="Nessun compleanno oggi."
        renderRight={(g) => (
          <Badge tone="gold" className="inline-flex items-center gap-1">
            <Cake className="h-3 w-3" /> oggi
          </Badge>
        )}
      />

      <Section
        title="Compleanni nei prossimi 7 giorni"
        description="Anticipa l&apos;invio di un coupon di benvenuto."
        icon={Cake}
        items={insights.birthdaysWeek}
        empty="Nessun compleanno in vista la prossima settimana."
        renderRight={(g) => {
          const d = nextBirthdayInDays(g.birthday);
          return (
            <Badge tone="neutral">
              {d === 1 ? "domani" : `tra ${d} giorni`}
            </Badge>
          );
        }}
      />

      {insights.vipsArrivingToday.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-gilt-dark" /> VIP / Ambassador in arrivo oggi
            </CardTitle>
            <CardDescription>
              Briefa la sala: chi sono, a che ora, allergie, occasione.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {insights.vipsArrivingToday.map((v) => (
                <li
                  key={v.bookingId}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-display text-base">
                      {v.startsAt.toLocaleTimeString("it-IT", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <div>
                      <p className="font-medium">
                        {v.guest.firstName}
                        {v.guest.lastName ? ` ${v.guest.lastName}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {v.partySize} pax · {v.occasion ?? "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <LoyaltyPill tier={v.guest.loyaltyTier as never} />
                    {v.guest.allergies && (
                      <Badge tone="danger">⚠️ {v.guest.allergies}</Badge>
                    )}
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/bookings/${v.bookingId}`}>Apri</Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/guests/${v.guest.id}`}>Scheda</Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {insights.todaysAllergies.length > 0 && (
        <Card className="border-rose-200 bg-rose-50/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-rose-700" /> Allergie da ricordare oggi
            </CardTitle>
            <CardDescription>
              Briefing pre-servizio per la cucina. Fai due check.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {insights.todaysAllergies.map((a) => (
                <li
                  key={a.bookingId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background px-3 py-2"
                >
                  <div>
                    <p className="font-medium">{a.guestName}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.startsAt.toLocaleTimeString("it-IT", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      · {a.partySize} pax
                    </p>
                  </div>
                  <Badge tone="danger" className="max-w-md text-xs">
                    {a.allergies}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Section
        title="Ospiti a rischio"
        description="Optin marketing attivo + nessuna visita da 60+ giorni. Manda un win-back."
        icon={AlertTriangle}
        items={insights.atRisk}
        empty="Nessun ospite a rischio: complimenti."
        renderRight={(g) => {
          const d = daysSince(g.lastVisitAt);
          return (
            <span className="text-xs text-muted-foreground">
              {d ? `${d}gg fa` : "—"}
            </span>
          );
        }}
      />

      <Section
        title="Tornano spesso"
        description="2+ visite negli ultimi 30 giorni. Ringraziali con un piccolo gesto."
        icon={Repeat}
        items={insights.recentReturning}
        empty="Nessun ospite ricorrente al momento."
        renderRight={(g) => (
          <Badge tone="success">
            <Flame className="mr-1 inline h-3 w-3" /> {g.totalVisits} visite
          </Badge>
        )}
      />
    </div>
  );
}

function Section({
  title,
  description,
  icon: Icon,
  items,
  empty,
  renderRight,
}: {
  title: string;
  description: string;
  icon: typeof Cake;
  items: GuestSummary[];
  empty: string;
  renderRight: (g: GuestSummary) => React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-gilt-dark" /> {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">
            {empty}
          </p>
        ) : (
          <ul className="divide-y text-sm">
            {items.map((g) => (
              <li
                key={g.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-secondary text-xs font-medium uppercase">
                    {g.firstName.slice(0, 1)}
                    {g.lastName?.slice(0, 1) ?? ""}
                  </span>
                  <div>
                    <p className="font-medium">
                      {g.firstName}
                      {g.lastName ? ` ${g.lastName}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {g.email ?? g.phone ?? "nessun contatto"}
                      {g.birthday ? ` · 🎂 ${formatDate(g.birthday)}` : ""}
                      {g.lastVisitAt ? ` · ultima visita ${formatDate(g.lastVisitAt)}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <LoyaltyPill tier={g.loyaltyTier as never} />
                  {renderRight(g)}
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/guests/${g.id}`}>Scheda</Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
