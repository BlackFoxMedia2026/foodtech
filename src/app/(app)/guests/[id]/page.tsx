import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Ban,
  Cake,
  CheckCircle2,
  Clock,
  Heart,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  ShieldAlert,
  ShoppingBag,
  Sparkles,
  Ticket,
  XCircle,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/empty-state";
import { LoyaltyPill, StatusPill, type BookingStatusKey, type LoyaltyKey } from "@/components/ui/status-pill";
import { LoyaltyBlockActions } from "@/components/guests/loyalty-block-actions";
import { GuestQuickActions } from "@/components/guests/guest-quick-actions";
import { can, getActiveVenue } from "@/lib/tenant";
import { getGuest } from "@/server/guests";
import { loyaltyHistory } from "@/server/loyalty";
import { db } from "@/lib/db";
import { formatCurrency, formatDate, formatDateTime, initials } from "@/lib/utils";
import { cn } from "@/lib/utils";

type Tab = "panoramica" | "vendite" | "marketing" | "loyalty";

export default async function GuestDetail({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tab?: string };
}) {
  const ctx = await getActiveVenue();
  const g = await getGuest(ctx.venueId, params.id);
  if (!g) notFound();
  const canSeePrivate = can(ctx.role, "view_private");
  const canEditMarketing = can(ctx.role, "edit_marketing");
  const canManageBookings = can(ctx.role, "manage_bookings");

  const tab: Tab =
    searchParams.tab === "marketing"
      ? "marketing"
      : searchParams.tab === "loyalty"
        ? "loyalty"
        : searchParams.tab === "vendite"
          ? "vendite"
          : "panoramica";

  const txns = await loyaltyHistory(g.id, tab === "loyalty" ? 50 : 8);

  const [messages, redemptions] =
    tab === "marketing"
      ? await Promise.all([
          db.messageLog.findMany({
            where: { guestId: g.id, venueId: ctx.venueId },
            orderBy: { createdAt: "desc" },
            take: 30,
            include: { campaign: { select: { name: true } } },
          }),
          db.couponRedemption.findMany({
            where: { guestId: g.id, venueId: ctx.venueId },
            orderBy: { redeemedAt: "desc" },
            take: 30,
            include: { coupon: { select: { code: true, name: true } } },
          }),
        ])
      : [[], []];

  const [orders, tickets, surveys] =
    tab === "vendite"
      ? await Promise.all([
          db.order.findMany({
            where: { guestId: g.id, venueId: ctx.venueId },
            orderBy: { createdAt: "desc" },
            take: 20,
            include: { items: true },
          }),
          g.email
            ? db.ticket.findMany({
                where: {
                  buyerEmail: g.email,
                  experience: { venueId: ctx.venueId },
                },
                orderBy: { createdAt: "desc" },
                take: 20,
                include: {
                  experience: { select: { title: true, startsAt: true } },
                },
              })
            : Promise.resolve([]),
          db.survey.findMany({
            where: {
              venueId: ctx.venueId,
              guestId: g.id,
              response: { isNot: null },
            },
            orderBy: { sentAt: "desc" },
            take: 10,
            include: { response: true },
          }),
        ])
      : [[], [], []];

  const name = `${g.firstName} ${g.lastName ?? ""}`.trim();
  const totalSpendCents = Math.round(Number(g.totalSpend) * 100);
  const avgSpendCents = g.totalVisits > 0 ? Math.round(totalSpendCents / g.totalVisits) : 0;
  const noShowRate = g.totalVisits > 0 ? Math.round((g.noShowCount / g.totalVisits) * 100) : 0;
  const riskLabel =
    noShowRate >= 30 ? "Alto" : noShowRate >= 10 ? "Medio" : g.totalVisits === 0 ? "—" : "Basso";
  const riskTone =
    noShowRate >= 30
      ? "text-status-no-show"
      : noShowRate >= 10
        ? "text-status-pending"
        : "text-status-confirmed";

  const now = Date.now();
  const nextBooking = g.bookings
    .filter((b) => new Date(b.startsAt).getTime() >= now && b.status !== "CANCELLED")
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0];
  const pastBookings = g.bookings.filter(
    (b) => new Date(b.startsAt).getTime() < now || b.status === "CANCELLED",
  );

  const birthdaySoon = (() => {
    if (!g.birthday) return false;
    const today = new Date();
    const bday = new Date(g.birthday);
    bday.setFullYear(today.getFullYear());
    const diff = (bday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 14;
  })();

  return (
    <div className="space-y-8 animate-fade-in">
      <Link
        href="/guests"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-secondary transition hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> CRM ospiti
      </Link>

      {/* HERO — Customer Intelligence Card */}
      <header className="grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-center">
        <div className="flex items-start gap-5">
          <Avatar className="h-16 w-16 shrink-0">
            <AvatarFallback className="text-display text-lg font-medium">
              {initials(name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <LoyaltyPill loyalty={g.loyaltyTier as LoyaltyKey} />
              {g.loyaltyPoints > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gilt/15 px-2 py-0.5 text-xs font-medium text-gilt-dark">
                  <Sparkles className="h-3 w-3" /> {g.loyaltyPoints} pt
                </span>
              )}
              {g.blocked && (
                <span className="inline-flex items-center gap-1 rounded-full bg-status-no-show-soft px-2 py-0.5 text-xs font-medium text-status-no-show">
                  <Ban className="h-3 w-3" /> Bloccato
                </span>
              )}
              {birthdaySoon && (
                <span className="inline-flex items-center gap-1 rounded-full bg-status-vip-soft px-2 py-0.5 text-xs font-medium text-status-vip">
                  <Cake className="h-3 w-3" /> Compleanno in arrivo
                </span>
              )}
            </div>
            <h1 className="text-display mt-2 text-[32px] font-medium leading-tight tracking-tight">
              {name}
            </h1>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-secondary">
              {g.email && (
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-tertiary" /> {g.email}
                </span>
              )}
              {g.phone && (
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-tertiary" /> {g.phone}
                </span>
              )}
              {g.birthday && (
                <span className="inline-flex items-center gap-1.5">
                  <Cake className="h-3.5 w-3.5 text-tertiary" /> {formatDate(g.birthday)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="lg:max-w-[520px]">
          <GuestQuickActions
            guestId={g.id}
            guestName={name}
            phone={g.phone}
            email={g.email}
            loyaltyTier={g.loyaltyTier as "NEW" | "REGULAR" | "VIP" | "AMBASSADOR"}
            canSeePrivate={canSeePrivate}
            canManageBookings={canManageBookings}
            canEditMarketing={canEditMarketing}
          />
        </div>
      </header>

      {/* KPI strip */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile label="Visite" value={String(g.totalVisits)} />
        <KpiTile label="Spesa totale" value={formatCurrency(totalSpendCents, ctx.venue.currency)} />
        <KpiTile
          label="Spesa media"
          value={g.totalVisits > 0 ? formatCurrency(avgSpendCents, ctx.venue.currency) : "—"}
          hint="per visita"
        />
        <KpiTile
          label="Rischio no-show"
          value={riskLabel}
          valueClassName={riskTone}
          hint={g.totalVisits > 0 ? `${noShowRate}% storico` : "Nessun dato"}
        />
      </section>

      {/* Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-border">
        <TabLink href={`/guests/${g.id}`} active={tab === "panoramica"}>
          Panoramica
        </TabLink>
        <TabLink href={`/guests/${g.id}?tab=vendite`} active={tab === "vendite"}>
          Vendite
        </TabLink>
        <TabLink href={`/guests/${g.id}?tab=marketing`} active={tab === "marketing"}>
          Marketing
        </TabLink>
        <TabLink href={`/guests/${g.id}?tab=loyalty`} active={tab === "loyalty"}>
          Loyalty
        </TabLink>
      </div>

      {tab === "panoramica" && (
      <section className="grid gap-6 lg:grid-cols-[1fr_1.5fr]">
        <div className="space-y-6">
          {/* Next booking */}
          {nextBooking ? (
            <Panel className="border-status-confirmed/30 bg-status-confirmed-soft/40">
              <PanelHeader
                title={
                  <span className="inline-flex items-center gap-2">
                    <Heart className="h-4 w-4 text-status-confirmed" /> Prossima prenotazione
                  </span>
                }
              />
              <PanelBody className="pt-0">
                <Link
                  href={`/bookings/${nextBooking.id}`}
                  className="group flex items-center gap-3 rounded-lg p-2 -m-2 transition hover:bg-card"
                >
                  <div className="w-14">
                    <p className="text-display text-numeric text-xl">
                      {new Date(nextBooking.startsAt).toLocaleDateString("it-IT", {
                        day: "2-digit",
                      })}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider text-tertiary">
                      {new Date(nextBooking.startsAt).toLocaleDateString("it-IT", {
                        month: "short",
                      })}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {new Date(nextBooking.startsAt).toLocaleTimeString("it-IT", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      · {nextBooking.partySize} persone
                    </p>
                    <p className="text-xs text-secondary">
                      {nextBooking.table?.label
                        ? `Tavolo ${nextBooking.table.label}`
                        : "Tavolo da assegnare"}
                    </p>
                  </div>
                  <StatusPill status={nextBooking.status as BookingStatusKey} />
                </Link>
              </PanelBody>
            </Panel>
          ) : null}

          {/* Preferenze e note */}
          <Panel>
            <PanelHeader title="Preferenze" />
            <PanelBody className="pt-0 space-y-3">
              {g.allergies && (
                <InfoRow
                  label="Allergie"
                  value={g.allergies}
                  tone="warning"
                />
              )}
              {g.tags.length > 0 && (
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-tertiary">
                    Tag
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {g.tags.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <InfoRow
                label="Marketing"
                value={g.marketingOptIn ? "Consenso attivo" : "Non iscritto"}
              />
              <InfoRow label="Lingua" value={g.language?.toUpperCase() ?? "IT"} />
              {!g.allergies && g.tags.length === 0 && (
                <p className="text-sm text-tertiary">
                  Nessuna preferenza registrata.
                </p>
              )}
            </PanelBody>
          </Panel>

          {/* Note riservate */}
          {g.privateNotes && (
            <Panel className={cn(!canSeePrivate && "opacity-70")}>
              <PanelHeader
                title={
                  <span className="inline-flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-tertiary" />
                    Note riservate
                  </span>
                }
                description={!canSeePrivate ? "Visibili solo al Manager" : undefined}
              />
              {canSeePrivate && (
                <PanelBody className="pt-0">
                  <p className="text-sm text-foreground/85 whitespace-pre-wrap">
                    {g.privateNotes}
                  </p>
                </PanelBody>
              )}
            </Panel>
          )}

          {/* Loyalty */}
          <Panel>
            <PanelHeader
              title={
                <span className="inline-flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-gilt-dark" /> Loyalty
                </span>
              }
              action={<span className="text-display text-numeric text-xl">{g.loyaltyPoints} pt</span>}
            />
            <PanelBody className="pt-0 space-y-3">
              <LoyaltyBlockActions
                guestId={g.id}
                blocked={g.blocked}
                blockedReason={g.blockedReason}
                canEdit={canEditMarketing}
                canBlock={canManageBookings}
              />
              {txns.length === 0 ? (
                <p className="text-xs text-tertiary">
                  Nessun movimento. I punti vengono accreditati a ordine completato.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {txns.map((t) => (
                    <li key={t.id} className="flex items-center justify-between py-1.5 text-xs">
                      <div>
                        <p className="font-medium">{t.reason ?? t.kind}</p>
                        <p className="text-[10.5px] text-tertiary">
                          {formatDateTime(t.createdAt)}
                        </p>
                      </div>
                      <span
                        className={
                          t.points > 0
                            ? "text-status-confirmed text-numeric font-medium"
                            : t.points < 0
                              ? "text-status-no-show text-numeric font-medium"
                              : "text-tertiary text-numeric"
                        }
                      >
                        {t.points > 0 ? "+" : ""}
                        {t.points}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </PanelBody>
          </Panel>
        </div>

        {/* Visit history */}
        <Panel>
          <PanelHeader
            title="Storico visite"
            description={`${pastBookings.length} visite registrate`}
            action={
              <Link
                href={`/guests/${g.id}/journey`}
                className="inline-flex items-center gap-1 text-xs font-medium text-secondary transition hover:text-foreground"
              >
                Timeline <ArrowRight className="h-3 w-3" />
              </Link>
            }
          />
          <PanelBody className="pt-0">
            {pastBookings.length === 0 ? (
              <EmptyState
                icon={Clock}
                title="Nessuna visita registrata"
                description="Le visite passate compariranno qui appena la prima prenotazione sarà completata."
              />
            ) : (
              <ul className="divide-y divide-border">
                {pastBookings.slice(0, 12).map((b) => (
                  <li key={b.id}>
                    <Link
                      href={`/bookings/${b.id}`}
                      className="flex items-center gap-4 py-3 transition-colors hover:bg-secondary/40 -mx-2 px-2 rounded-md"
                    >
                      <div className="w-14 text-right">
                        <p className="text-display text-numeric text-base">
                          {new Date(b.startsAt).toLocaleDateString("it-IT", {
                            day: "2-digit",
                          })}
                        </p>
                        <p className="text-[10px] uppercase tracking-wider text-tertiary">
                          {new Date(b.startsAt).toLocaleDateString("it-IT", { month: "short" })}
                        </p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          {new Date(b.startsAt).toLocaleTimeString("it-IT", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                        <p className="text-xs text-secondary">
                          {b.partySize} persone · {b.table?.label ? `T${b.table.label}` : "—"}
                        </p>
                      </div>
                      <StatusPill status={b.status as BookingStatusKey} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </PanelBody>
        </Panel>
      </section>
      )}

      {tab === "vendite" && (
        <section className="grid gap-6 lg:grid-cols-3">
          <Panel>
            <PanelHeader
              title={
                <span className="inline-flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-tertiary" /> Ordini
                </span>
              }
              description={`${orders.length} ordini delivery/asporto`}
            />
            <PanelBody className="pt-0">
              {orders.length === 0 ? (
                <EmptyState
                  icon={ShoppingBag}
                  title="Nessun ordine"
                  description="Asporto e delivery legati a questo ospite appariranno qui."
                />
              ) : (
                <ul className="divide-y divide-border">
                  {orders.map((o) => (
                    <li key={o.id} className="py-2.5 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-medium">
                          {o.kind === "DELIVERY" ? "Delivery" : "Asporto"}
                          <span className="ml-2 font-mono text-[11px] text-tertiary">
                            #{o.reference.slice(0, 8)}
                          </span>
                        </p>
                        <span className="text-display text-numeric text-sm font-medium">
                          {formatCurrency(o.totalCents, ctx.venue.currency)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-tertiary">
                        {o.items.length} articoli ·{" "}
                        {formatDateTime(o.createdAt)} · {o.status}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader
              title={
                <span className="inline-flex items-center gap-2">
                  <Ticket className="h-4 w-4 text-tertiary" /> Eventi & Ticket
                </span>
              }
              description={`${tickets.length} ticket acquistati`}
            />
            <PanelBody className="pt-0">
              {tickets.length === 0 ? (
                <EmptyState
                  icon={Ticket}
                  title="Nessun ticket"
                  description="Eventi e ticket comprati appariranno qui."
                />
              ) : (
                <ul className="divide-y divide-border">
                  {tickets.map((t) => (
                    <li key={t.id} className="py-2.5 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-medium">
                          {t.experience?.title ?? "Esperienza"}
                        </p>
                        <span className="text-display text-numeric text-sm font-medium">
                          {formatCurrency(t.totalCents, ctx.venue.currency)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-tertiary">
                        {t.quantity} ticket ·{" "}
                        {t.experience?.startsAt
                          ? formatDateTime(t.experience.startsAt)
                          : ""}{" "}
                        · {t.status}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader
              title="Feedback & NPS"
              description={`${surveys.length} sondaggi compilati`}
            />
            <PanelBody className="pt-0">
              {surveys.length === 0 ? (
                <EmptyState
                  icon={Heart}
                  title="Nessun feedback"
                  description="Le risposte ai sondaggi post-visita appariranno qui."
                />
              ) : (
                <ul className="divide-y divide-border">
                  {surveys.map((s) => {
                    if (!s.response) return null;
                    const sentiment = s.response.sentiment;
                    const tone =
                      sentiment === "PROMOTER"
                        ? "text-status-confirmed bg-status-confirmed-soft"
                        : sentiment === "PASSIVE"
                          ? "text-status-pending bg-status-pending-soft"
                          : "text-status-no-show bg-status-no-show-soft";
                    const sentimentLabel =
                      sentiment === "PROMOTER"
                        ? "Promotore"
                        : sentiment === "PASSIVE"
                          ? "Passivo"
                          : "Detrattore";
                    return (
                      <li key={s.id} className="py-2.5 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-display text-numeric text-xl font-medium leading-none">
                            {s.response.npsScore}
                            <span className="ml-0.5 text-xs text-tertiary">/10</span>
                          </span>
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-medium",
                              tone,
                            )}
                          >
                            {sentimentLabel}
                          </span>
                        </div>
                        {s.response.comment && (
                          <p className="mt-1 line-clamp-2 text-xs italic text-tertiary">
                            “{s.response.comment}”
                          </p>
                        )}
                        <p className="mt-0.5 text-[10.5px] text-tertiary">
                          {formatDateTime(s.response.createdAt)}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </PanelBody>
          </Panel>
        </section>
      )}

      {tab === "marketing" && (
        <section className="grid gap-6 lg:grid-cols-2">
          <Panel>
            <PanelHeader
              title={
                <span className="inline-flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-tertiary" /> Campagne ricevute
                </span>
              }
              description={`${messages.length} messaggi negli ultimi mesi`}
            />
            <PanelBody className="pt-0">
              {messages.length === 0 ? (
                <EmptyState
                  icon={MessageSquare}
                  title="Nessun messaggio inviato"
                  description="Quando questo ospite riceverà campagne email/SMS/WhatsApp le vedrai qui."
                />
              ) : (
                <ul className="divide-y divide-border">
                  {messages.map((m) => (
                    <li key={m.id} className="py-2.5 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-medium">
                          {m.campaign?.name ?? m.subject ?? "Messaggio automatico"}
                        </p>
                        <MessageStatusBadge status={m.status} />
                      </div>
                      <p className="mt-0.5 text-xs text-tertiary">
                        {m.channel} · {formatDateTime(m.createdAt)}
                      </p>
                      {m.bodyPreview && (
                        <p className="mt-1 line-clamp-2 text-xs text-secondary">
                          {m.bodyPreview}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader
              title={
                <span className="inline-flex items-center gap-2">
                  <Ticket className="h-4 w-4 text-tertiary" /> Coupon riscattati
                </span>
              }
              description={`${redemptions.length} riscossioni totali`}
            />
            <PanelBody className="pt-0">
              {redemptions.length === 0 ? (
                <EmptyState
                  icon={Ticket}
                  title="Nessun coupon usato"
                  description="Quando questo ospite riscatterà un coupon (sconto, omaggio, evento) lo vedrai qui."
                />
              ) : (
                <ul className="divide-y divide-border">
                  {redemptions.map((r) => (
                    <li key={r.id} className="py-2.5 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-medium">
                          {r.coupon?.name ?? r.coupon?.code ?? "Coupon"}
                        </p>
                        {r.amountCents != null && (
                          <span className="text-numeric text-status-confirmed font-medium text-xs">
                            -{formatCurrency(r.amountCents, ctx.venue.currency)}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-tertiary">
                        {r.coupon?.code && (
                          <span className="font-mono">{r.coupon.code} · </span>
                        )}
                        {formatDateTime(r.redeemedAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </PanelBody>
          </Panel>
        </section>
      )}

      {tab === "loyalty" && (
        <Panel>
          <PanelHeader
            title={
              <span className="inline-flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-gilt-dark" /> Storico loyalty
              </span>
            }
            description={`${g.loyaltyPoints} punti attuali · ${txns.length} movimenti`}
          />
          <PanelBody className="pt-0">
            {txns.length === 0 ? (
              <EmptyState
                icon={Sparkles}
                title="Nessun movimento loyalty"
                description="I punti vengono accreditati a ordine completato o tramite operazione manuale."
              />
            ) : (
              <ul className="divide-y divide-border">
                {txns.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between py-2.5 text-sm"
                  >
                    <div>
                      <p className="font-medium">{t.reason ?? t.kind}</p>
                      <p className="text-[11px] text-tertiary">
                        {formatDateTime(t.createdAt)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "text-numeric font-medium",
                        t.points > 0
                          ? "text-status-confirmed"
                          : t.points < 0
                            ? "text-status-no-show"
                            : "text-tertiary",
                      )}
                    >
                      {t.points > 0 ? "+" : ""}
                      {t.points} pt
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </PanelBody>
        </Panel>
      )}
    </div>
  );
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
        active
          ? "border-foreground text-foreground"
          : "border-transparent text-secondary hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

function MessageStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; tone: string; icon: React.ReactNode }> = {
    SENT: { label: "Inviato", tone: "text-status-confirmed bg-status-confirmed-soft", icon: <CheckCircle2 className="h-3 w-3" /> },
    DELIVERED: { label: "Consegnato", tone: "text-status-confirmed bg-status-confirmed-soft", icon: <CheckCircle2 className="h-3 w-3" /> },
    QUEUED: { label: "In coda", tone: "text-secondary bg-secondary", icon: <Clock className="h-3 w-3" /> },
    FAILED: { label: "Errore", tone: "text-status-no-show bg-status-no-show-soft", icon: <XCircle className="h-3 w-3" /> },
  };
  const m = map[status] ?? { label: status, tone: "text-secondary bg-secondary", icon: null };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium", m.tone)}>
      {m.icon} {m.label}
    </span>
  );
}

function KpiTile({
  label,
  value,
  hint,
  valueClassName,
}: {
  label: string;
  value: string;
  hint?: string;
  valueClassName?: string;
}) {
  return (
    <div className="panel p-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-tertiary">{label}</p>
      <p
        className={cn(
          "mt-1 text-display text-numeric text-2xl font-medium leading-none",
          valueClassName,
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-[11px] text-tertiary">{hint}</p>}
    </div>
  );
}

function InfoRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warning";
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-tertiary">{label}</p>
      <p
        className={cn(
          "text-right text-sm",
          tone === "warning" ? "text-status-no-show font-medium" : "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}
