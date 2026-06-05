// Provider-agnostic AI adapter.
// In production hook a real LLM via OPENAI_API_KEY or ANTHROPIC_API_KEY.
// Without keys we run a deterministic local stub that derives suggestions
// from SQL queries — useful for the demo and as a sane fallback.

import { db } from "@/lib/db";
import { startOfDay, endOfDay } from "@/lib/utils";
import { getProactiveContext, type ProactiveContext } from "@/server/insights";

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

  const [todayBookings, prevWeekBookings, vipsToday, allergiesToday, unassigned, depositsHeld, recentNoShow, proactive] =
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
      getProactiveContext(venueId, today).catch(() => null),
    ]);

  const todayCovers = todayBookings.reduce((s, b) => s + b.partySize, 0);
  const prevCovers = prevWeekBookings.reduce((s, b) => s + b.partySize, 0);
  const delta = prevCovers === 0 ? 0 : Math.round(((todayCovers - prevCovers) / prevCovers) * 100);
  const widget = todayBookings.filter((b) => b.source === "WIDGET").length;

  const suggestions: Suggestion[] = [];

  // ─── Heuristic proattive ─────────────────────────────────────────────────
  if (proactive) {
    suggestions.push(...buildProactiveSuggestions(proactive));
  }

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

  // Optional LLM enrichment: rewrites summary to a warmer, restaurant-owner
  // tone in Italian and may add a single extra OPPORTUNITY suggestion.
  let summary = summaryLines.join(" ");
  let extra: Suggestion | null = null;
  let generatedBy = whichAIProvider();
  const polished = await polishWithLLM(summaryLines, suggestions).catch(() => null);
  if (polished) {
    summary = polished.summary;
    extra = polished.extra;
  } else {
    generatedBy = "heuristic";
  }

  // Dedup per id e per (kind+title), poi ordina ALERT > OPPORTUNITY > INFO, max 4
  const ranked = dedupeAndRank([...suggestions, ...(extra ? [extra] : [])], 4);

  return {
    summary,
    suggestions: [
      {
        id: "summary",
        kind: "SUMMARY",
        title: "Brief operativo",
        body: summary,
      },
      ...ranked,
    ],
    generatedBy,
  };
}

// ─── Proactive heuristic builder ─────────────────────────────────────────────
function buildProactiveSuggestions(ctx: ProactiveContext): Suggestion[] {
  const out: Suggestion[] = [];
  const now = ctx.now;

  // a) No-show risk imminente: booking nei prossimi 60min con noShowCount >= 2
  for (const b of ctx.imminentBookings) {
    if (!b.guest || (b.guest.noShowCount ?? 0) < 2) continue;
    const name = guestDisplay(b.guest);
    const arrival = formatTime(b.startsAt);
    out.push({
      id: `noshow-risk-${b.id}`,
      kind: "ALERT",
      title: `Manda conferma a ${name}`,
      body: `${b.guest.noShowCount} no-show storici · arrivo previsto ${arrival}`,
      actionHref: `/bookings/${b.id}`,
      actionLabel: "Conferma via SMS",
    });
  }

  // b) VIP arriving entro 30min senza tavolo
  for (const b of ctx.imminentBookings) {
    if (!b.guest) continue;
    if (b.guest.loyaltyTier !== "VIP" && b.guest.loyaltyTier !== "AMBASSADOR") continue;
    if (b.tableId) continue;
    const minutesToArrival = Math.round((new Date(b.startsAt).getTime() - now.getTime()) / 60000);
    if (minutesToArrival < 0 || minutesToArrival > 30) continue;
    const name = guestDisplay(b.guest);
    out.push({
      id: `vip-arriving-${b.id}`,
      kind: "ALERT",
      title: `${name} (VIP) arriva tra ${minutesToArrival}min — assegnare tavolo?`,
      body: `Tavolo non ancora assegnato. Apri la prenotazione e scegli il posto migliore.`,
      actionHref: `/bookings/${b.id}`,
      actionLabel: "Apri prenotazione",
    });
  }

  // c) Birthday today con booking attiva
  for (const b of ctx.birthdayBookings) {
    if (!b.guest?.birthday) continue;
    const bday = new Date(b.guest.birthday);
    if (bday.getMonth() !== now.getMonth() || bday.getDate() !== now.getDate()) continue;
    const name = guestDisplay(b.guest);
    out.push({
      id: `birthday-${b.id}`,
      kind: "OPPORTUNITY",
      title: `🎂 ${name} compie gli anni oggi`,
      body: `Prevedi un calice offerto, briefa la sala.`,
      actionHref: `/guests/${b.guest.id}`,
      actionLabel: "Apri scheda",
    });
  }

  // d) Sala vuota off-peak (occupancy < 30% in fascia 12-14 o 19-22)
  if (ctx.lunchOccupancy !== null && ctx.lunchOccupancy < 0.3) {
    out.push({
      id: "empty-lunch",
      kind: "OPPORTUNITY",
      title: `Sala vuota fascia ${ctx.lunchSlot.from}-${ctx.lunchSlot.to} — opportunity`,
      body: `Occupancy ${Math.round(ctx.lunchOccupancy * 100)}%. Considera coupon flash o promo last-minute.`,
      actionHref: "/coupons",
      actionLabel: "Crea coupon",
    });
  }
  if (ctx.dinnerOccupancy !== null && ctx.dinnerOccupancy < 0.3) {
    out.push({
      id: "empty-dinner",
      kind: "OPPORTUNITY",
      title: `Sala vuota fascia ${ctx.dinnerSlot.from}-${ctx.dinnerSlot.to} — opportunity`,
      body: `Occupancy ${Math.round(ctx.dinnerOccupancy * 100)}%. Considera coupon flash o promo last-minute.`,
      actionHref: "/coupons",
      actionLabel: "Crea coupon",
    });
  }

  // e) Detrattore NPS recente (ultima settimana, score <= 6)
  if (ctx.detractors.length > 0) {
    const worst = ctx.detractors[0];
    out.push({
      id: `detractor-${worst.createdAt.getTime()}`,
      kind: "ALERT",
      title: `Detrattore NPS ${worst.npsScore} — risposta entro 24h?`,
      body: `Feedback negativo recente. Recupera l'ospite con una chiamata o messaggio personale.`,
      actionHref: "/insights/feedback",
      actionLabel: "Vedi feedback",
    });
  }

  // f) Coupon in scadenza con redemption <30%
  for (const c of ctx.expiringCoupons) {
    const cap = c.maxRedemptions ?? 0;
    if (cap > 0) {
      const rate = c.redemptionCount / cap;
      if (rate >= 0.3) continue;
    }
    // Se non c'è cap, considera "non riscatto" se redemptionCount == 0
    if (cap === 0 && c.redemptionCount > 0) continue;
    const daysLeft = Math.max(
      1,
      Math.ceil((new Date(c.validUntil!).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
    );
    out.push({
      id: `coupon-expiring-${c.id}`,
      kind: "OPPORTUNITY",
      title: `Coupon "${c.name}" scade tra ${daysLeft}gg — promuovi`,
      body: cap > 0
        ? `Solo ${c.redemptionCount}/${cap} riscatti finora. Lancia una campagna mirata.`
        : `Ancora nessun riscatto. Lancia una campagna mirata.`,
      actionHref: "/campaigns",
      actionLabel: "Lancia campagna",
    });
  }

  // g) Waitlist con avg wait > 25min
  if (ctx.waitlistEntries.length > 0) {
    const avgWait =
      ctx.waitlistEntries.reduce((s, w) => s + (w.expectedWaitMin ?? 0), 0) /
      ctx.waitlistEntries.length;
    if (avgWait > 25) {
      out.push({
        id: "waitlist-long",
        kind: "ALERT",
        title: `Coda con attese >${Math.round(avgWait)}min — staff dedicato?`,
        body: `${ctx.waitlistEntries.length} ospiti in coda. Valuta uno staff member dedicato per accoglierli.`,
        actionHref: "/waitlist",
        actionLabel: "Apri coda",
      });
    }
  }

  return out;
}

function guestDisplay(g: { firstName: string; lastName?: string | null }) {
  return [g.firstName, g.lastName].filter(Boolean).join(" ").trim() || "Ospite";
}

function formatTime(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

function dedupeAndRank(items: Suggestion[], max: number): Suggestion[] {
  const priority: Record<Suggestion["kind"], number> = {
    ALERT: 0,
    OPPORTUNITY: 1,
    INFO: 2,
    SUMMARY: 3,
  };
  const seen = new Set<string>();
  const unique: Suggestion[] = [];
  for (const s of items) {
    const key = `${s.kind}:${s.title}`;
    if (seen.has(s.id) || seen.has(key)) continue;
    seen.add(s.id);
    seen.add(key);
    unique.push(s);
  }
  unique.sort((a, b) => priority[a.kind] - priority[b.kind]);
  return unique.slice(0, max);
}

async function polishWithLLM(
  facts: string[],
  signals: Suggestion[],
): Promise<{ summary: string; extra: Suggestion | null } | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const model = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001";
  const factText = facts.map((f) => `- ${f}`).join("\n");
  const signalText = signals
    .map((s) => `- [${s.kind}] ${s.title}: ${s.body}`)
    .join("\n");
  const prompt = `Sei un assistente operativo per un ristorante italiano. Riassumi la giornata in 2-3 frasi calde e motivanti, evitando jargon. Tono cortese, italiano, evita emoji.\n\nDATI OPERATIVI:\n${factText}\n\nSEGNALI GIA' RILEVATI:\n${signalText || "Nessuno"}\n\nRispondi STRETTAMENTE in JSON così:\n{"summary": "...", "extra": {"id": "kebab-case", "kind": "OPPORTUNITY"|"INFO", "title": "...", "body": "...", "actionLabel": "...?", "actionHref": "/...?"}}\nSe non hai un suggerimento utile, restituisci "extra": null.`;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 600,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) {
      console.warn("[ai:anthropic] non-ok", res.status);
      return null;
    }
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text =
      data.content?.find((c) => c.type === "text")?.text ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as {
      summary?: string;
      extra?: {
        id?: string;
        kind?: string;
        title?: string;
        body?: string;
        actionLabel?: string;
        actionHref?: string;
      } | null;
    };
    if (!parsed.summary) return null;
    let extra: Suggestion | null = null;
    if (parsed.extra && parsed.extra.title && parsed.extra.body) {
      const kind = (parsed.extra.kind === "OPPORTUNITY" || parsed.extra.kind === "INFO" || parsed.extra.kind === "ALERT")
        ? parsed.extra.kind
        : "INFO";
      extra = {
        id: parsed.extra.id ?? `ai-${Date.now()}`,
        kind,
        title: parsed.extra.title,
        body: parsed.extra.body,
        actionLabel: parsed.extra.actionLabel,
        actionHref: parsed.extra.actionHref,
      };
    }
    return { summary: parsed.summary, extra };
  } catch (err) {
    console.warn("[ai:anthropic] error", err);
    return null;
  }
}

function shift(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}
