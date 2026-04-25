// Provider-agnostic AI adapter.
// In production hook a real LLM via OPENAI_API_KEY or ANTHROPIC_API_KEY.
// Without keys we run a deterministic local stub that derives suggestions
// from SQL queries — useful for the demo and as a sane fallback.

import { db } from "@/lib/db";
import { startOfDay, endOfDay } from "@/lib/utils";

export type Suggestion = {
  id: string;
  kind: "ALERT" | "OPPORTUNITY" | "INFO" | "SUMMARY";
  title: string;
  body: string;
  actionLabel?: string;
  actionHref?: string;
};

export function isAIEnabled() {
  return Boolean(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY);
}

export function whichAIProvider() {
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "heuristic";
}

export async function generateDailyBrief(venueId: string): Promise<{
  summary: string;
  suggestions: Suggestion[];
  generatedBy: string;
}> {
  const today = new Date();
  const dayStart = startOfDay(today);
  const dayEnd = endOfDay(today);

  const [todayBookings, prevWeekBookings, vipsToday, allergiesToday, unassigned, depositsHeld, recentNoShow] =
    await Promise.all([
      db.booking.findMany({
        where: {
          venueId,
          startsAt: { gte: dayStart, lte: dayEnd },
          status: { not: "CANCELLED" },
        },
        select: { partySize: true, status: true, source: true, tableId: true, depositStatus: true },
      }),
      db.booking.findMany({
        where: {
          venueId,
          startsAt: { gte: shift(dayStart, -7), lte: shift(dayEnd, -7) },
          status: { not: "CANCELLED" },
        },
        select: { partySize: true },
      }),
      db.booking.count({
        where: {
          venueId,
          startsAt: { gte: dayStart, lte: dayEnd },
          guest: { loyaltyTier: { in: ["VIP", "AMBASSADOR"] } },
        },
      }),
      db.booking.count({
        where: {
          venueId,
          startsAt: { gte: dayStart, lte: dayEnd },
          guest: { allergies: { not: null } },
        },
      }),
      db.booking.count({
        where: {
          venueId,
          startsAt: { gte: dayStart, lte: dayEnd },
          tableId: null,
          status: { in: ["CONFIRMED", "PENDING"] },
        },
      }),
      db.booking.count({
        where: {
          venueId,
          startsAt: { gte: dayStart, lte: dayEnd },
          depositStatus: "HELD",
        },
      }),
      db.guest.count({
        where: {
          venueId,
          noShowCount: { gte: 3 },
        },
      }),
    ]);

  const todayCovers = todayBookings.reduce((s, b) => s + b.partySize, 0);
  const prevCovers = prevWeekBookings.reduce((s, b) => s + b.partySize, 0);
  const delta = prevCovers === 0 ? 0 : Math.round(((todayCovers - prevCovers) / prevCovers) * 100);
  const widget = todayBookings.filter((b) => b.source === "WIDGET").length;

  const suggestions: Suggestion[] = [];

  if (unassigned > 0) {
    suggestions.push({
      id: "unassigned",
      kind: "ALERT",
      title: `${unassigned} prenotazioni senza tavolo`,
      body: "Apri /now o /bookings (timeline) per assegnarle prima del servizio.",
      actionLabel: "Vai alla vista sala",
      actionHref: "/now",
    });
  }
  if (allergiesToday > 0) {
    suggestions.push({
      id: "allergies",
      kind: "ALERT",
      title: `${allergiesToday} ospiti con allergie segnalate`,
      body: "Avvisa la cucina e controlla la scheda CRM di ciascun ospite.",
    });
  }
  if (vipsToday > 0) {
    suggestions.push({
      id: "vips",
      kind: "OPPORTUNITY",
      title: `${vipsToday} ospiti VIP/Ambassador attesi`,
      body: "Considera un benvenuto personalizzato (welcome drink, biglietto a mano).",
    });
  }
  if (depositsHeld > 0) {
    suggestions.push({
      id: "deposits",
      kind: "INFO",
      title: `${depositsHeld} caparre già trattenute`,
      body: "Le entrate da caparra sono protette. Niente da fare se non incassare al servizio.",
    });
  }
  if (recentNoShow > 0) {
    suggestions.push({
      id: "noshow_seg",
      kind: "OPPORTUNITY",
      title: `${recentNoShow} ospiti con 3+ no-show storici`,
      body: "Per gruppi >4 chiedi pre-conferma o caparra. Considera il segmento &quot;No-show&quot; per una campagna mirata.",
      actionLabel: "Vai a Ospiti",
      actionHref: "/guests?segment=no_show_3",
    });
  }
  if (widget === 0 && todayCovers > 0) {
    suggestions.push({
      id: "widget_zero",
      kind: "INFO",
      title: "Oggi nessuna prenotazione dal widget pubblico",
      body: "Verifica che il link /b/<slug> sia condiviso e che i turni del giorno siano attivi.",
      actionLabel: "Apri Impostazioni",
      actionHref: "/settings",
    });
  }

  const summaryLines = [
    `Oggi sono attese ${todayCovers} coperti su ${todayBookings.length} prenotazioni.`,
    delta !== 0
      ? `Andamento ${delta > 0 ? "+" : ""}${delta}% rispetto allo stesso giorno della scorsa settimana.`
      : `Stesso volume della scorsa settimana.`,
    widget > 0 ? `${widget} richieste arrivano dal widget pubblico.` : null,
  ].filter(Boolean) as string[];

  return {
    summary: summaryLines.join(" "),
    suggestions: [
      {
        id: "summary",
        kind: "SUMMARY",
        title: "Brief operativo",
        body: summaryLines.join(" "),
      },
      ...suggestions,
    ],
    generatedBy: whichAIProvider(),
  };
}

function shift(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}
