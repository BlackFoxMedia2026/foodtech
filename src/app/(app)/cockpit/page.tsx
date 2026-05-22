import Link from "next/link";
import {
  ArrowUpRight,
  CalendarRange,
  Megaphone,
  MessagesSquare,
  Network,
  PhoneCall,
  Sparkles,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { db } from "@/lib/db";
import { getActiveVenue, can } from "@/lib/tenant";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Stat } from "@/components/ui/stat";
import { financeOverview } from "@/server/finance";
import { feedbackStats } from "@/server/surveys";
import { messageLogStats } from "@/server/messages";
import { chatStats } from "@/server/chat";
import { connectorStats } from "@/server/connectors";
import { voiceStats } from "@/server/voice";
import { wifiStats } from "@/server/wifi";
import { reputationStats } from "@/server/review-links";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CockpitPage() {
  const ctx = await getActiveVenue();
  const since30 = new Date(Date.now() - 30 * 86400_000);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const [
    todayBookings,
    weekBookings,
    finance,
    feedback,
    msgStats,
    automationRuns,
    automationFailed,
    chat,
    connectors,
    voice,
    wifi,
    reputation,
  ] = await Promise.all([
    db.booking.count({
      where: { venueId: ctx.venueId, startsAt: { gte: today, lt: tomorrow } },
    }),
    db.booking.count({
      where: { venueId: ctx.venueId, startsAt: { gte: since30 } },
    }),
    can(ctx.role, "view_revenue")
      ? financeOverview(ctx.venueId, 30)
      : Promise.resolve(null),
    feedbackStats(ctx.venueId),
    messageLogStats(ctx.venueId),
    db.automationRun.count({
      where: { venueId: ctx.venueId, createdAt: { gte: since30 } },
    }),
    db.automationRun.count({
      where: { venueId: ctx.venueId, createdAt: { gte: since30 }, status: "FAILED" },
    }),
    chatStats(ctx.venueId),
    connectorStats(ctx.venueId),
    voiceStats(ctx.venueId),
    wifiStats(ctx.venueId),
    reputationStats(ctx.venueId),
  ]);

  const msgTotals = msgStats.reduce(
    (acc, m) => {
      acc.total += m.count;
      if (m.status === "SENT" || m.status === "DELIVERED") acc.sent += m.count;
      if (m.status === "FAILED") acc.failed += m.count;
      if (m.status === "SKIPPED") acc.skipped += m.count;
      return acc;
    },
    { total: 0, sent: 0, failed: 0, skipped: 0 },
  );

  type Tile = {
    title: string;
    href: string;
    icon: LucideIcon;
    description: string;
    metrics: { label: string; value: string | number; emphasize?: boolean }[];
    show: boolean;
  };

  const tiles: Tile[] = [
    {
      title: "Sala & prenotazioni",
      href: "/bookings",
      icon: CalendarRange,
      description: "Prenotazioni di oggi e degli ultimi 30 giorni.",
      metrics: [
        { label: "Oggi", value: todayBookings, emphasize: true },
        { label: "30 giorni", value: weekBookings },
        { label: "NPS", value: feedback.total > 0 ? feedback.nps : "—" },
      ],
      show: true,
    },
    {
      title: "Channel manager",
      href: "/connectors",
      icon: Network,
      description: "Eventi inbound dai canali esterni.",
      metrics: [
        { label: "Attivi", value: connectors.active, emphasize: true },
        { label: "Processati", value: connectors.processed },
        { label: "Errori", value: connectors.failed + connectors.rejected },
      ],
      show: can(ctx.role, "manage_venue"),
    },
    {
      title: "Marketing & messaging",
      href: "/campaigns",
      icon: Megaphone,
      description: "Email/SMS/WhatsApp inviati negli ultimi 30 giorni.",
      metrics: [
        { label: "Inviati", value: msgTotals.sent, emphasize: true },
        { label: "Falliti", value: msgTotals.failed },
        { label: "Saltati", value: msgTotals.skipped },
      ],
      show: can(ctx.role, "edit_marketing"),
    },
    {
      title: "Automazioni",
      href: "/automations",
      icon: Workflow,
      description: "Esecuzioni dei workflow automatici.",
      metrics: [
        { label: "Esecuzioni 30gg", value: automationRuns, emphasize: true },
        { label: "Fallite", value: automationFailed },
      ],
      show: can(ctx.role, "edit_marketing"),
    },
    {
      title: "Chatbot",
      href: "/chat",
      icon: MessagesSquare,
      description: "Sessioni chat e tasso di conversione.",
      metrics: [
        { label: "Sessioni 30gg", value: chat.total, emphasize: true },
        { label: "Convertite", value: chat.converted },
        { label: "Tasso", value: `${chat.convRate}%` },
      ],
      show: true,
    },
    {
      title: "Assistente vocale",
      href: "/voice",
      icon: PhoneCall,
      description: "Chiamate ricevute e bozze in attesa.",
      metrics: [
        { label: "Chiamate 30gg", value: voice.calls, emphasize: true },
        { label: "Bozze", value: voice.drafts },
        { label: "Convertite", value: voice.converted },
      ],
      show: can(ctx.role, "manage_bookings"),
    },
    {
      title: "Wi-Fi marketing",
      href: "/wifi",
      icon: Sparkles,
      description: "Lead da captive portal e ritorni.",
      metrics: [
        { label: "Lead 30gg", value: wifi.leads30d, emphasize: true },
        { label: "Opt-in", value: `${wifi.marketingOptInRate}%` },
        { label: "Ritorni", value: wifi.returningLeads },
      ],
      show: can(ctx.role, "edit_marketing"),
    },
    {
      title: "Reputazione",
      href: "/insights/feedback",
      icon: Sparkles,
      description: "Click sulle review platform.",
      metrics: [
        { label: "Click 30gg", value: reputation.clicks30d, emphasize: true },
        { label: "Totali", value: reputation.totalClicks },
      ],
      show: true,
    },
  ];

  const visibleTiles = tiles.filter((t) => t.show);

  return (
    <div className="space-y-6 animate-fade-in">
      <header>
        <p className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-tertiary">
          {ctx.venue.name} · Executive cockpit
        </p>
        <h1 className="text-display mt-1 text-[34px] font-medium leading-tight tracking-tight">
          Cockpit
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-secondary">
          KPI aggregati su 30 giorni dai moduli operativi: prenotazioni, marketing, conversational, channel.
        </p>
      </header>

      {finance && (
        <section className="grid gap-3 md:grid-cols-4">
          <Stat
            label="Ricavi 30gg"
            value={formatCurrency(finance.totalRevenueCents, ctx.venue.currency)}
            hint="incassi tracciati"
            emphasized
          />
          <Stat
            label="Margine lordo"
            value={formatCurrency(finance.grossMarginCents, ctx.venue.currency)}
            hint={`${finance.marginRate}% del fatturato`}
          />
          <Stat
            label="Food cost"
            value={`${finance.foodCostRate}%`}
            hint={
              finance.foodCostRate < 32
                ? "sotto controllo"
                : "monitora menu"
            }
          />
          <Stat
            label="Costo lavoro"
            value={`${finance.laborCostRate}%`}
            hint={
              finance.laborCostRate < 28
                ? "buono"
                : "verifica turni"
            }
          />
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleTiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <Panel key={tile.href}>
              <PanelHeader
                title={
                  <span className="inline-flex items-center gap-2.5">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-gilt/15 text-gilt-light">
                      <Icon className="h-4 w-4" />
                    </span>
                    {tile.title}
                  </span>
                }
                description={tile.description}
                action={
                  <Link
                    href={tile.href}
                    className="inline-flex items-center gap-1 text-xs font-medium text-secondary transition hover:text-foreground"
                  >
                    Apri <ArrowUpRight className="h-3 w-3" />
                  </Link>
                }
              />
              <PanelBody className="pt-0">
                <div className="grid grid-cols-3 gap-2">
                  {tile.metrics.map((m) => (
                    <div
                      key={m.label}
                      className={cn(
                        "rounded-lg px-2 py-2 text-center",
                        m.emphasize
                          ? "bg-[hsl(var(--surface-sunken))]/60"
                          : "",
                      )}
                    >
                      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-tertiary">
                        {m.label}
                      </p>
                      <p
                        className={cn(
                          "mt-1 text-display text-numeric leading-none tabular-nums",
                          m.emphasize ? "text-xl font-medium" : "text-base font-medium",
                        )}
                      >
                        {m.value}
                      </p>
                    </div>
                  ))}
                </div>
              </PanelBody>
            </Panel>
          );
        })}
      </div>

      <Panel>
        <PanelHeader
          title="Composizione canali messaggi (30gg)"
          description="Stato per canale dal MessageLog: utile per individuare provider non configurati o in errore."
        />
        <PanelBody className="pt-0">
          {msgStats.length === 0 ? (
            <p className="text-sm text-tertiary">
              Nessun messaggio inviato negli ultimi 30 giorni.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {msgStats.map((s, i) => (
                <span
                  key={`${s.channel}-${s.status}-${i}`}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-[hsl(var(--surface-sunken))]/40 px-2.5 py-0.5 text-[10.5px] font-medium"
                >
                  <span className="text-tertiary">{s.channel}</span>
                  <span className="text-tertiary">·</span>
                  <span>{s.status}</span>
                  <span className="text-numeric text-tertiary">{s.count}</span>
                </span>
              ))}
            </div>
          )}
        </PanelBody>
      </Panel>
    </div>
  );
}
