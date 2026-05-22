import Link from "next/link";
import {
  AlertTriangle,
  Cake,
  Crown,
  Flame,
  Repeat,
  ShieldAlert,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { getActiveVenue } from "@/lib/tenant";
import { getSegmentInsights, type GuestSummary } from "@/server/guest-insights";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Stat } from "@/components/ui/stat";
import { EmptyStateRich } from "@/components/ui/empty-state-rich";
import {
  LoyaltyPill,
  type LoyaltyKey,
} from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

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
          <p className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-tertiary">
            Ospiti · Marketing proattivo
          </p>
          <h1 className="text-display mt-1 flex items-center gap-3 text-[34px] font-medium leading-tight tracking-tight">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gilt/15 text-gilt-light">
              <Sparkles className="h-5 w-5" />
            </span>
            Smart insights
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-secondary">
            Chi compie gli anni a breve, chi non torna da troppo, chi arriva oggi che
            merita un&apos;attenzione speciale.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/guests">← CRM ospiti</Link>
        </Button>
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        <Stat
          label="Compleanni oggi"
          value={insights.birthdaysToday.length}
          hint={
            insights.birthdaysToday.length > 0
              ? "celebra appena arrivano"
              : "nessuno oggi"
          }
          emphasized
        />
        <Stat
          label="Compleanni 7gg"
          value={insights.birthdaysWeek.length}
          hint="prepara un coupon"
        />
        <Stat
          label="VIP oggi"
          value={insights.vipsArrivingToday.length}
          hint={
            insights.vipsArrivingToday.length > 0
              ? "briefa la sala"
              : "nessun VIP"
          }
        />
        <Stat
          label="A rischio"
          value={insights.atRisk.length}
          hint={
            insights.atRisk.length > 0 ? "manda un win-back" : "tutti in linea"
          }
          delta={
            insights.atRisk.length > 5
              ? { value: "alto", tone: "negative" }
              : insights.atRisk.length > 0
                ? { value: "qualche", tone: "neutral" }
                : { value: "ok", tone: "positive" }
          }
        />
      </section>

      <Section
        title="Compleanni di oggi"
        description="Ricorda allo staff. Canta happy birthday e magari un calice offerto."
        icon={Cake}
        items={insights.birthdaysToday}
        emptyTitle="Nessun compleanno oggi"
        emptyHint="Domani forse — controlla il prossimo blocco."
        renderRight={() => (
          <span className="inline-flex items-center gap-1 rounded-full bg-gilt/15 px-2.5 py-0.5 text-[10.5px] font-medium text-gilt-light">
            <Cake className="h-3 w-3" /> oggi
          </span>
        )}
      />

      <Section
        title="Compleanni nei prossimi 7 giorni"
        description="Anticipa l'invio di un coupon di benvenuto via WhatsApp o email."
        icon={Cake}
        items={insights.birthdaysWeek}
        emptyTitle="Nessun compleanno questa settimana"
        renderRight={(g) => {
          const d = nextBirthdayInDays(g.birthday);
          return (
            <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-[10.5px] font-medium">
              {d === 1 ? "domani" : `tra ${d} giorni`}
            </span>
          );
        }}
      />

      {insights.vipsArrivingToday.length > 0 && (
        <Panel>
          <PanelHeader
            title={
              <span className="inline-flex items-center gap-2">
                <Crown className="h-4 w-4 text-gilt-light" /> VIP & Ambassador oggi
              </span>
            }
            description="Briefa la sala: chi sono, a che ora, allergie, occasione."
          />
          <PanelBody className="pt-0">
            <ul className="divide-y divide-border">
              {insights.vipsArrivingToday.map((v) => (
                <li
                  key={v.bookingId}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-display text-numeric w-16 text-base font-medium leading-none tabular-nums">
                      {v.startsAt.toLocaleTimeString("it-IT", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <div>
                      <p className="flex items-center gap-1.5 font-medium">
                        {v.guest.firstName}
                        {v.guest.lastName ? ` ${v.guest.lastName}` : ""}
                        <Crown className="h-3 w-3 text-gilt-light" />
                      </p>
                      <p className="text-xs text-tertiary">
                        {v.partySize} pax · {v.occasion ?? "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <LoyaltyPill loyalty={v.guest.loyaltyTier as LoyaltyKey} />
                    {v.guest.allergies && (
                      <span className="inline-flex items-center rounded-full bg-status-no-show-soft px-2.5 py-0.5 text-[10.5px] font-medium text-status-no-show">
                        ⚠ {v.guest.allergies}
                      </span>
                    )}
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/bookings/${v.bookingId}`}>Apri</Link>
                    </Button>
                    <Button asChild variant="subtle" size="sm">
                      <Link href={`/guests/${v.guest.id}`}>Scheda</Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </PanelBody>
        </Panel>
      )}

      {insights.todaysAllergies.length > 0 && (
        <Panel className="border-status-no-show/30 bg-status-no-show-soft/40">
          <PanelHeader
            title={
              <span className="inline-flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-status-no-show" /> Allergie oggi
              </span>
            }
            description="Briefing pre-servizio per la cucina. Fai due check."
          />
          <PanelBody className="pt-0">
            <ul className="space-y-2">
              {insights.todaysAllergies.map((a) => (
                <li
                  key={a.bookingId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-sm"
                >
                  <div>
                    <p className="font-medium">{a.guestName}</p>
                    <p className="text-xs text-tertiary">
                      {a.startsAt.toLocaleTimeString("it-IT", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      · {a.partySize} pax
                    </p>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-status-no-show-soft px-2.5 py-0.5 text-[10.5px] font-medium text-status-no-show">
                    {a.allergies}
                  </span>
                </li>
              ))}
            </ul>
          </PanelBody>
        </Panel>
      )}

      <Section
        title="Ospiti a rischio abbandono"
        description="Opt-in marketing attivo + nessuna visita da 60+ giorni. Manda un win-back."
        icon={AlertTriangle}
        items={insights.atRisk}
        emptyTitle="Nessun ospite a rischio"
        emptyHint="Complimenti — la retention è in forma."
        renderRight={(g) => {
          const d = daysSince(g.lastVisitAt);
          return (
            <span className="text-numeric text-xs text-status-pending font-medium">
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
        emptyTitle="Nessun ospite ricorrente"
        renderRight={(g) => (
          <span className="inline-flex items-center gap-1 rounded-full bg-status-confirmed-soft px-2.5 py-0.5 text-[10.5px] font-medium text-status-confirmed">
            <Flame className="h-3 w-3" /> {g.totalVisits} visite
          </span>
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
  emptyTitle,
  emptyHint,
  renderRight,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  items: GuestSummary[];
  emptyTitle: string;
  emptyHint?: string;
  renderRight: (g: GuestSummary) => React.ReactNode;
}) {
  return (
    <Panel>
      <PanelHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Icon className="h-4 w-4 text-tertiary" /> {title}
          </span>
        }
        description={description}
      />
      <PanelBody className="pt-0">
        {items.length === 0 ? (
          <EmptyStateRich
            size="compact"
            icon={Icon}
            title={emptyTitle}
            description={emptyHint}
          />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((g) => (
              <li
                key={g.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="text-display grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary text-xs font-medium uppercase">
                    {g.firstName.slice(0, 1)}
                    {g.lastName?.slice(0, 1) ?? ""}
                  </span>
                  <div>
                    <p className="font-medium">
                      {g.firstName}
                      {g.lastName ? ` ${g.lastName}` : ""}
                    </p>
                    <p className={cn("mt-0.5 text-xs text-tertiary")}>
                      {g.email ?? g.phone ?? "nessun contatto"}
                      {g.birthday ? ` · 🎂 ${formatDate(g.birthday)}` : ""}
                      {g.lastVisitAt
                        ? ` · ultima visita ${formatDate(g.lastVisitAt)}`
                        : ""}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <LoyaltyPill loyalty={g.loyaltyTier as LoyaltyKey} />
                  {renderRight(g)}
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/guests/${g.id}`}>Scheda</Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </PanelBody>
    </Panel>
  );
}
