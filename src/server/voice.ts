import { z } from "zod";
import { db } from "@/lib/db";
import { voiceProvider } from "@/lib/voice-provider";
import { notify } from "@/server/notifications";

export const InboundCallInput = z.object({
  fromNumber: z.string().min(3).max(40),
  toNumber: z.string().max(40).optional().nullable(),
  recordingUrl: z.string().url().optional().nullable(),
  transcript: z.string().max(5000).optional().nullable(),
  durationSec: z.coerce.number().int().min(0).optional(),
  status: z
    .enum(["RINGING", "IN_PROGRESS", "COMPLETED", "MISSED", "FAILED"])
    .default("COMPLETED"),
});

export const VoiceDraftInput = z.object({
  callerName: z.string().min(2).max(80).optional().nullable(),
  phone: z.string().min(3).max(40).optional().nullable(),
  partySize: z.coerce.number().int().min(1).max(40).optional().nullable(),
  preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  preferredTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export async function recordInboundCall(venueSlug: string, raw: unknown) {
  const data = InboundCallInput.parse(raw);
  const venue = await db.venue.findFirst({
    where: { slug: venueSlug, active: true },
    select: { id: true },
  });
  if (!venue) throw new Error("venue_not_found");

  const draft = extractDraftFromTranscript(data.transcript ?? "");
  const draftRow = draft
    ? await db.voiceBookingDraft.create({
        data: {
          venueId: venue.id,
          callerName: draft.callerName ?? null,
          phone: data.fromNumber,
          partySize: draft.partySize ?? null,
          preferredDate: draft.preferredDate ?? null,
          preferredTime: draft.preferredTime ?? null,
          notes: draft.notes ?? null,
        },
      })
    : null;

  const call = await db.callLog.create({
    data: {
      venueId: venue.id,
      fromNumber: data.fromNumber,
      toNumber: data.toNumber ?? null,
      recordingUrl: data.recordingUrl ?? null,
      transcript: data.transcript ?? null,
      durationSec: data.durationSec ?? null,
      status: data.status,
      intent: draft ? "BOOKING" : "INFO",
      draftId: draftRow?.id ?? null,
      startedAt: new Date(),
      endedAt: data.status === "COMPLETED" ? new Date() : null,
    },
  });

  if (data.status === "MISSED") {
    await markMissedCall(venue.id, data.fromNumber);
    await notify({
      venueId: venue.id,
      kind: "MISSED_CALL",
      title: "Chiamata persa",
      body: data.fromNumber,
      link: "/voice",
    });
  }
  if (draftRow) {
    await notify({
      venueId: venue.id,
      kind: "MISSED_CALL",
      title: "Bozza voice da approvare",
      body: `${draftRow.callerName ?? "Sconosciuto"} · ${draftRow.partySize ?? "?"} pax · ${draftRow.preferredDate ?? "—"}`,
      link: "/voice",
    });
  }

  return { callId: call.id, draftId: draftRow?.id ?? null };
}

export async function markMissedCall(venueId: string, fromNumber: string) {
  const existing = await db.missedCall.findFirst({
    where: { venueId, fromNumber, callbackSentAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    return db.missedCall.update({
      where: { id: existing.id },
      data: { attempts: existing.attempts + 1 },
    });
  }
  return db.missedCall.create({ data: { venueId, fromNumber } });
}

export async function listCallLogs(venueId: string, limit = 50) {
  return db.callLog.findMany({
    where: { venueId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { draft: true },
  });
}

export async function listVoiceDrafts(venueId: string) {
  return db.voiceBookingDraft.findMany({
    where: { venueId, status: "NEW" },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function listMissedCalls(venueId: string) {
  return db.missedCall.findMany({
    where: { venueId, callbackSentAt: null },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function approveVoiceDraft(
  venueId: string,
  draftId: string,
  reviewerId: string | null,
) {
  const draft = await db.voiceBookingDraft.findFirst({
    where: { id: draftId, venueId, status: "NEW" },
  });
  if (!draft) throw new Error("not_found");
  if (!draft.partySize || !draft.preferredDate || !draft.preferredTime) {
    throw new Error("incomplete");
  }
  const startsAt = new Date(`${draft.preferredDate}T${draft.preferredTime}:00`);
  if (Number.isNaN(startsAt.getTime())) throw new Error("invalid_datetime");

  // Find or create the guest
  const phone = draft.phone ?? "";
  let guest = phone
    ? await db.guest.findFirst({ where: { venueId, phone } })
    : null;
  if (!guest) {
    const [first, ...rest] = (draft.callerName ?? "Ospite").split(" ");
    guest = await db.guest.create({
      data: {
        venueId,
        firstName: first || "Ospite",
        lastName: rest.join(" ") || null,
        phone: phone || null,
      },
    });
  }

  const booking = await db.booking.create({
    data: {
      venueId,
      guestId: guest.id,
      partySize: draft.partySize,
      startsAt,
      durationMin: 105,
      source: "PHONE",
      status: "CONFIRMED",
      notes: draft.notes ?? null,
    },
  });
  await db.voiceBookingDraft.update({
    where: { id: draftId },
    data: { status: "CONFIRMED", bookingId: booking.id, reviewedBy: reviewerId },
  });
  return booking;
}

export async function rejectVoiceDraft(
  venueId: string,
  draftId: string,
  reviewerId: string | null,
) {
  const draft = await db.voiceBookingDraft.findFirst({
    where: { id: draftId, venueId },
  });
  if (!draft) throw new Error("not_found");
  await db.voiceBookingDraft.update({
    where: { id: draftId },
    data: { status: "REJECTED", reviewedBy: reviewerId },
  });
}

export async function scheduleMissedCallback(venueId: string, missedId: string) {
  const m = await db.missedCall.findFirst({ where: { id: missedId, venueId } });
  if (!m) throw new Error("not_found");
  await voiceProvider().scheduleCallback({ fromNumber: m.fromNumber });
  return db.missedCall.update({
    where: { id: missedId },
    data: { callbackSentAt: new Date() },
  });
}

export async function voiceStats(venueId: string) {
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const [calls, missed, drafts, converted] = await Promise.all([
    db.callLog.count({ where: { venueId, createdAt: { gte: since } } }),
    db.missedCall.count({ where: { venueId, createdAt: { gte: since } } }),
    db.voiceBookingDraft.count({
      where: { venueId, status: "NEW" },
    }),
    db.voiceBookingDraft.count({
      where: { venueId, status: "CONFIRMED", createdAt: { gte: since } },
    }),
  ]);
  return { calls, missed, drafts, converted };
}

// ─── Lightweight transcript parser (rule-based) ─────────────────────────────
// We aim for "good enough" without external NLU. The conversational booking
// flow is interactive (chat); voice drafts go through manager review.

function extractDraftFromTranscript(transcript: string) {
  const t = transcript.toLowerCase();
  if (!t.trim()) return null;

  const partyMatch = t.match(
    /(?:per\s+)?(\d{1,2})\s+(?:persone|coperti|posti|in)/,
  );
  const partySize = partyMatch ? Number(partyMatch[1]) : null;
  if (partySize == null) return null;

  const dateMatch = matchDateLike(t);
  const timeMatch = t.match(/(\d{1,2})[:.](\d{2})/);
  const time = timeMatch
    ? `${String(Math.min(23, Number(timeMatch[1]))).padStart(2, "0")}:${String(
        Math.min(59, Number(timeMatch[2])),
      ).padStart(2, "0")}`
    : null;
  const nameMatch = transcript.match(
    /(?:nome|chiamo|sono)\s+([A-ZÀ-Ÿ][a-zà-ÿ]+(?:\s+[A-ZÀ-Ÿ][a-zà-ÿ]+)?)/,
  );
  return {
    callerName: nameMatch ? nameMatch[1] : null,
    partySize,
    preferredDate: dateMatch,
    preferredTime: time,
    notes: transcript.length > 400 ? transcript.slice(0, 400) : transcript,
  };
}

function matchDateLike(t: string): string | null {
  const now = new Date();
  if (/\boggi\b|\bstasera\b/.test(t)) return formatISODate(now);
  if (/\bdomani\b/.test(t)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return formatISODate(d);
  }
  const iso = t.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

function formatISODate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
