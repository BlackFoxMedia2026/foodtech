import { z } from "zod";
import { db } from "@/lib/db";
import { createPublicBooking, getAvailableSlots, getPublicVenue } from "@/server/widget";
import { type Locale, pickLocale, t } from "@/lib/i18n";
import { captureError } from "@/lib/observability";
import { notify } from "@/server/notifications";

export const ChatStartInput = z.object({
  source: z.enum(["WEB", "WIDGET", "WHATSAPP", "SMS", "VOICE"]).default("WEB"),
  language: z.string().min(2).max(5).default("it"),
});

export const ChatTurnInput = z.object({
  text: z.string().min(1).max(2000),
});

export type BotMessage = {
  reply: string;
  intent: ChatIntent;
  quickReplies?: string[];
  draft: ChatDraft;
  status: "OPEN" | "CONVERTED" | "HANDOFF";
  bookingReference?: string;
  alternatives?: { date: string; time: string }[];
};

type ChatIntent =
  | "GREETING"
  | "ASK_PARTY_SIZE"
  | "ASK_DATE"
  | "ASK_TIME"
  | "ASK_NAME"
  | "ASK_CONTACT"
  | "CONFIRM"
  | "BOOKED"
  | "FALLBACK"
  | "HANDOFF";

type ChatDraft = {
  partySize?: number | null;
  date?: string | null;
  time?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
};

// ─── Public API ──────────────────────────────────────────────────────────────

export async function startChatSession(slug: string, raw: unknown) {
  const data = ChatStartInput.parse(raw);
  const venue = await getPublicVenue(slug);
  if (!venue) throw new Error("venue_not_found");

  const locale = pickLocale(data.language);
  const session = await db.chatSession.create({
    data: { venueId: venue.id, source: data.source, language: locale },
  });

  const greeting = t(locale, "bot.greeting", { venue: venue.name });
  await db.chatMessage.create({
    data: {
      sessionId: session.id,
      role: "BOT",
      text: greeting,
      intent: "GREETING",
    },
  });

  return {
    sessionId: session.id,
    venue: { name: venue.name, slug: venue.slug, city: venue.city },
    bot: {
      reply: greeting,
      intent: "GREETING" as const,
      quickReplies: [
        t(locale, "bot.qr.book"),
        t(locale, "bot.qr.hours"),
        t(locale, "bot.qr.staff"),
      ],
      draft: {} as ChatDraft,
      status: "OPEN" as const,
    } satisfies BotMessage,
  };
}

export async function postChatTurn(sessionId: string, raw: unknown) {
  const { text } = ChatTurnInput.parse(raw);
  const session = await db.chatSession.findUnique({
    where: { id: sessionId },
    include: { venue: { select: { id: true, name: true, slug: true } } },
  });
  if (!session) throw new Error("not_found");
  if (session.status !== "OPEN") throw new Error("closed");

  await db.chatMessage.create({
    data: { sessionId: session.id, role: "USER", text },
  });

  const draft = readDraft(session);
  const locale = pickLocale(session.language);
  const result = await advanceConversation(session.venue, draft, text, locale);

  await db.chatSession.update({
    where: { id: session.id },
    data: {
      draftPartySize: result.draft.partySize ?? undefined,
      draftDate: result.draft.date ?? undefined,
      draftTime: result.draft.time ?? undefined,
      draftFirstName: result.draft.firstName ?? undefined,
      draftLastName: result.draft.lastName ?? undefined,
      draftEmail: result.draft.email ?? undefined,
      draftPhone: result.draft.phone ?? undefined,
      draftNotes: result.draft.notes ?? undefined,
      status:
        result.status === "CONVERTED"
          ? "CONVERTED"
          : result.status === "HANDOFF"
            ? "HANDOFF"
            : "OPEN",
    },
  });

  await db.chatMessage.create({
    data: {
      sessionId: session.id,
      role: "BOT",
      text: result.reply,
      intent: result.intent,
      payload: result.alternatives ? { alternatives: result.alternatives } : undefined,
    },
  });

  if (result.status === "HANDOFF") {
    await notify({
      venueId: session.venueId,
      kind: "CHAT_HANDOFF",
      title: "Chat · richiesta operatore",
      body: text.slice(0, 200),
      link: "/chat",
    });
  }

  return result;
}

function readDraft(s: {
  draftPartySize: number | null;
  draftDate: string | null;
  draftTime: string | null;
  draftFirstName: string | null;
  draftLastName: string | null;
  draftEmail: string | null;
  draftPhone: string | null;
  draftNotes: string | null;
}): ChatDraft {
  return {
    partySize: s.draftPartySize,
    date: s.draftDate,
    time: s.draftTime,
    firstName: s.draftFirstName,
    lastName: s.draftLastName,
    email: s.draftEmail,
    phone: s.draftPhone,
    notes: s.draftNotes,
  };
}

// ─── Conversation logic (rule-based, deterministic, no external deps) ────────

const HANDOFF_TOKENS = /\b(staff|operatore|umano|aiuto|operator|human|help)\b/;

async function advanceConversation(
  venue: { id: string; name: string; slug: string },
  draftIn: ChatDraft,
  rawInput: string,
  locale: Locale,
): Promise<BotMessage> {
  const text = rawInput.trim();
  const lower = text.toLowerCase();
  const draft = { ...draftIn };
  const tr = (key: string, vars?: Record<string, string | number>) =>
    t(locale, key as never, vars);

  if (HANDOFF_TOKENS.test(lower)) {
    return {
      reply: tr("bot.handoff"),
      intent: "HANDOFF",
      draft,
      status: "HANDOFF",
    };
  }

  // 1. Party size
  const partyMatch = text.match(/\b(\d{1,2})\b/);
  if (draft.partySize == null && partyMatch) {
    const n = Number(partyMatch[1]);
    if (n >= 1 && n <= 30) draft.partySize = n;
  }
  if (draft.partySize == null) {
    return {
      reply: tr("bot.askParty"),
      intent: "ASK_PARTY_SIZE",
      quickReplies: ["2", "3", "4", "6"],
      draft,
      status: "OPEN",
    };
  }

  // 2. Date
  if (!draft.date) {
    const parsedDate = parseDate(lower);
    if (parsedDate) draft.date = parsedDate;
  }
  if (!draft.date) {
    return {
      reply: tr("bot.askDate", { party: draft.partySize }),
      intent: "ASK_DATE",
      quickReplies: [
        tr("bot.qr.tonight"),
        tr("bot.qr.tomorrow"),
        tr("bot.qr.friday"),
        tr("bot.qr.saturday"),
      ],
      draft,
      status: "OPEN",
    };
  }

  // 3. Time + availability check
  if (!draft.time) {
    const parsedTime = parseTime(text);
    if (parsedTime) draft.time = parsedTime;
  }
  if (!draft.time) {
    const slots = await getAvailableSlots(venue.id, draft.date, draft.partySize);
    const free = slots.filter((s) => s.available).map((s) => s.time);
    if (free.length === 0) {
      return {
        reply: tr("bot.noSlots", { date: draft.date, party: draft.partySize }),
        intent: "ASK_DATE",
        draft: { ...draft, date: null },
        status: "OPEN",
      };
    }
    return {
      reply: tr("bot.askTime", { date: draft.date, slots: free.slice(0, 6).join(", ") }),
      intent: "ASK_TIME",
      quickReplies: free.slice(0, 6),
      draft,
      status: "OPEN",
    };
  }

  // Validate slot
  const slots = await getAvailableSlots(venue.id, draft.date, draft.partySize);
  const slot = slots.find((s) => s.time === draft.time);
  if (!slot || !slot.available) {
    const free = slots.filter((s) => s.available).map((s) => s.time).slice(0, 6);
    return {
      reply: free.length
        ? tr("bot.slotTaken", { slots: free.join(", ") })
        : tr("bot.dayFull"),
      intent: free.length ? "ASK_TIME" : "ASK_DATE",
      quickReplies: free,
      draft: { ...draft, time: null, ...(free.length ? {} : { date: null }) },
      status: "OPEN",
    };
  }

  // 4. Name
  if (!draft.firstName) {
    const name = parseName(text);
    if (name) {
      draft.firstName = name.first;
      draft.lastName = name.last ?? null;
    } else {
      return {
        reply: tr("bot.askName"),
        intent: "ASK_NAME",
        draft,
        status: "OPEN",
      };
    }
  }

  // 5. Contact
  if (!draft.email && !draft.phone) {
    const email = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/i)?.[0];
    const phone = text.match(/\+?\d[\d\s./-]{6,}/)?.[0]?.replace(/\s+/g, "");
    if (email) draft.email = email;
    if (phone) draft.phone = phone;
    if (!draft.email && !draft.phone) {
      return {
        reply: tr("bot.askContact", { first: draft.firstName }),
        intent: "ASK_CONTACT",
        draft,
        status: "OPEN",
      };
    }
  }

  // 6. Confirm + create booking
  const confirmIntent = isConfirmation(lower);
  if (!confirmIntent) {
    const fullName = `${draft.firstName}${draft.lastName ? " " + draft.lastName : ""}`;
    return {
      reply: tr("bot.confirm", {
        party: draft.partySize,
        date: draft.date,
        time: draft.time,
        name: fullName,
      }),
      intent: "CONFIRM",
      quickReplies: [tr("bot.qr.confirm"), tr("bot.qr.cancel")],
      draft,
      status: "OPEN",
    };
  }

  try {
    const booking = await createPublicBooking(venue.slug, {
      partySize: draft.partySize,
      date: draft.date,
      time: draft.time,
      firstName: draft.firstName,
      lastName: draft.lastName ?? undefined,
      email: draft.email ?? `${slugify(draft.firstName)}+chat@${venue.slug}.local`,
      phone: draft.phone ?? "0000000000",
      marketingOptIn: false,
      notes: draft.notes ?? undefined,
    });
    return {
      reply: tr("bot.booked", { reference: booking.reference, venue: venue.name }),
      intent: "BOOKED",
      draft,
      status: "CONVERTED",
      bookingReference: booking.reference,
    };
  } catch (err) {
    const code = err instanceof Error ? err.message : "unknown";
    if (code !== "slot_unavailable") {
      captureError(err, {
        module: "chat",
        venueId: venue.id,
        extra: { stage: "createPublicBooking", draft },
      });
    }
    return {
      reply:
        code === "slot_unavailable"
          ? tr("bot.error.slotJustTaken")
          : tr("bot.error.generic", { code }),
      intent: "FALLBACK",
      draft: { ...draft, time: null },
      status: "OPEN",
    };
  }
}

export function parseDate(input: string): string | null {
  const today = new Date();
  const yyyy = today.getFullYear();
  const month = today.getMonth();
  const day = today.getDate();

  if (/\boggi\b|\bstasera\b|\bstamani\b/.test(input)) {
    return formatISODate(today);
  }
  if (/\bdomani\b/.test(input)) {
    const d = new Date(today);
    d.setDate(day + 1);
    return formatISODate(d);
  }
  if (/\bdopodomani\b/.test(input)) {
    const d = new Date(today);
    d.setDate(day + 2);
    return formatISODate(d);
  }

  const weekdays: Record<string, number> = {
    domenica: 0,
    lunedi: 1,
    "lunedì": 1,
    martedi: 2,
    "martedì": 2,
    mercoledi: 3,
    "mercoledì": 3,
    giovedi: 4,
    "giovedì": 4,
    venerdi: 5,
    "venerdì": 5,
    sabato: 6,
  };
  for (const [k, target] of Object.entries(weekdays)) {
    if (input.includes(k)) {
      const d = new Date(today);
      const diff = (target - today.getDay() + 7) % 7 || 7;
      d.setDate(day + diff);
      return formatISODate(d);
    }
  }

  // Numeric date dd/mm or dd-mm or yyyy-mm-dd
  const iso = input.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const ddmm = input.match(/(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?/);
  if (ddmm) {
    const dd = String(ddmm[1]).padStart(2, "0");
    const mm = String(ddmm[2]).padStart(2, "0");
    let y = Number(ddmm[3] ?? yyyy);
    if (y < 100) y += 2000;
    if (Number(mm) < month + 1 && !ddmm[3]) y = yyyy + 1;
    return `${y}-${mm}-${dd}`;
  }
  return null;
}

export function parseTime(input: string): string | null {
  const m = input.match(/\b(\d{1,2})[:.h](\d{2})?\b/);
  if (m) {
    const h = Math.max(0, Math.min(23, Number(m[1])));
    const mm = m[2] ? Math.max(0, Math.min(59, Number(m[2]))) : 0;
    return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  }
  // single number like "20" → 20:00
  const single = input.match(/\b([01]?\d|2[0-3])\b/);
  if (single) {
    const h = Number(single[1]);
    if (h >= 11 && h <= 23) return `${String(h).padStart(2, "0")}:00`;
  }
  return null;
}

export function parseName(input: string): { first: string; last?: string } | null {
  const cleaned = input
    .replace(/\bmi\s+chiamo\b/gi, "")
    .replace(/\bsono\b/gi, "")
    .trim();
  const parts = cleaned
    .split(/\s+/)
    .filter((p) => /^[A-Za-zÀ-ÿ'\-]{2,}$/.test(p));
  if (parts.length === 0) return null;
  if (parts.length === 1) return { first: capitalize(parts[0]) };
  return { first: capitalize(parts[0]), last: parts.slice(1).map(capitalize).join(" ") };
}

function isConfirmation(s: string): boolean {
  return /\b(s[iì]|conferm|ok|va bene|procedi|certo|yes|yep|sure|confirm|go ahead|let'?s do it)\b/.test(s);
}

function formatISODate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .toLowerCase()
    .replace(/^-+|-+$/g, "");
}

// ─── Admin helpers ───────────────────────────────────────────────────────────

export async function listChatSessions(venueId: string, limit = 50) {
  return db.chatSession.findMany({
    where: { venueId },
    orderBy: { updatedAt: "desc" },
    take: limit,
    include: {
      _count: { select: { messages: true } },
    },
  });
}

export async function chatStats(venueId: string) {
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const groups = await db.chatSession.groupBy({
    by: ["status"],
    where: { venueId, createdAt: { gte: since } },
    _count: { _all: true },
  });
  const total = groups.reduce((s, g) => s + g._count._all, 0);
  const converted =
    groups.find((g) => g.status === "CONVERTED")?._count._all ?? 0;
  return {
    total,
    converted,
    handoff: groups.find((g) => g.status === "HANDOFF")?._count._all ?? 0,
    abandoned: groups.find((g) => g.status === "ABANDONED")?._count._all ?? 0,
    convRate: total > 0 ? Math.round((converted / total) * 100) : 0,
  };
}
