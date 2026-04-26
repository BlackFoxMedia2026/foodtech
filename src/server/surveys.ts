import { z } from "zod";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";

export const ResponseInput = z.object({
  npsScore: z.coerce.number().int().min(0).max(10),
  comment: z.string().max(2000).optional().nullable(),
  recommend: z.coerce.boolean().optional().nullable(),
});

export type ResponseInputType = z.infer<typeof ResponseInput>;

export function npsSentiment(score: number): "PROMOTER" | "PASSIVE" | "DETRACTOR" {
  if (score >= 9) return "PROMOTER";
  if (score >= 7) return "PASSIVE";
  return "DETRACTOR";
}

export async function getSurveyByToken(token: string) {
  return db.survey.findUnique({
    where: { token },
    include: {
      venue: {
        select: {
          id: true,
          name: true,
          slug: true,
          city: true,
          email: true,
          reviewLinks: {
            where: { active: true },
            orderBy: { ordering: "asc" },
            select: { id: true, platform: true, label: true, url: true },
          },
        },
      },
      response: true,
    },
  });
}

export async function recordResponse(token: string, raw: unknown) {
  const data = ResponseInput.parse(raw);
  const survey = await db.survey.findUnique({
    where: { token },
    include: { response: true, venue: { select: { name: true, email: true } } },
  });
  if (!survey) throw new Error("not_found");
  if (survey.response) throw new Error("already_submitted");
  const sentiment = npsSentiment(data.npsScore);
  const [_resp, updatedSurvey] = await db.$transaction([
    db.surveyResponse.create({
      data: {
        surveyId: survey.id,
        npsScore: data.npsScore,
        comment: data.comment ?? null,
        recommend: data.recommend ?? null,
        sentiment,
      },
    }),
    db.survey.update({ where: { id: survey.id }, data: { respondedAt: new Date() } }),
  ]);

  // Real-time alert to the venue when the feedback is negative
  if (sentiment === "DETRACTOR" && survey.venue.email) {
    const safeComment = (data.comment ?? "").replace(/</g, "&lt;");
    void sendEmail({
      to: { email: survey.venue.email, name: survey.venue.name },
      subject: `⚠️ Feedback negativo · NPS ${data.npsScore}/10 · ${survey.venue.name}`,
      html: `<p>Hai ricevuto un feedback critico (NPS <strong>${data.npsScore}/10</strong>).</p>${
        data.comment
          ? `<p><strong>Commento:</strong></p><blockquote style="border-left:3px solid #c9a25a;margin:0;padding:8px 12px;background:#fbf8ef">${safeComment}</blockquote>`
          : ""
      }<p>Apri Tavolo &gt; Analytics &gt; Recensioni per il dettaglio.</p>`,
      text: `Feedback negativo NPS ${data.npsScore}/10. ${data.comment ?? ""}`,
    });
  }

  return { survey: updatedSurvey, sentiment };
}

export async function ensureSurveyForBooking(bookingId: string) {
  const existing = await db.survey.findUnique({ where: { bookingId } });
  if (existing) return existing;
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, venueId: true, guestId: true },
  });
  if (!booking) return null;
  return db.survey.create({
    data: {
      bookingId: booking.id,
      venueId: booking.venueId,
      guestId: booking.guestId,
    },
  });
}

export async function listFeedback(venueId: string, limit = 100) {
  return db.surveyResponse.findMany({
    where: { survey: { venueId } },
    include: {
      survey: {
        include: {
          venue: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function feedbackStats(venueId: string) {
  const rows = await db.surveyResponse.findMany({
    where: { survey: { venueId } },
    select: { npsScore: true, sentiment: true },
  });
  if (rows.length === 0) return { total: 0, nps: 0, promoter: 0, passive: 0, detractor: 0, avg: 0 };
  const promoter = rows.filter((r) => r.sentiment === "PROMOTER").length;
  const passive = rows.filter((r) => r.sentiment === "PASSIVE").length;
  const detractor = rows.filter((r) => r.sentiment === "DETRACTOR").length;
  const nps = Math.round(((promoter - detractor) / rows.length) * 100);
  const avg = rows.reduce((s, r) => s + r.npsScore, 0) / rows.length;
  return { total: rows.length, nps, promoter, passive, detractor, avg: Math.round(avg * 10) / 10 };
}

export function renderSurveyEmail(opts: {
  guestFirstName: string;
  venueName: string;
  link: string;
}) {
  const safe = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = `<!doctype html><html lang="it"><body style="margin:0;background:#f7f4ec;font-family:-apple-system,sans-serif;color:#15161a"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f4ec;padding:32px 16px"><tr><td align="center"><table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #e8e1cf;border-radius:14px"><tr><td style="padding:28px"><p style="margin:0 0 6px;color:#7a7466;font-size:12px;letter-spacing:.16em;text-transform:uppercase">Ti ringraziamo</p><h1 style="margin:0 0 14px;font-family:Georgia,serif;font-size:24px">Com'è andata, ${safe(opts.guestFirstName)}?</h1><p style="margin:0 0 16px;font-size:15px;line-height:1.55">Speriamo che la tua esperienza presso <strong>${safe(opts.venueName)}</strong> ti sia piaciuta. Ci aiuti con un click?</p><p style="margin:0 0 18px"><a href="${opts.link}" style="display:inline-block;background:#c9a25a;color:#15161a;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Lascia un feedback</a></p><p style="margin:0;font-size:12px;color:#7a7466">Bastano 30 secondi. Le tue parole ci aiutano a migliorare.</p></td></tr></table></td></tr></table></body></html>`;
  return {
    subject: `${opts.venueName} · com'è andata?`,
    html,
    text: `Com'è andata, ${opts.guestFirstName}? Lasciaci un feedback: ${opts.link}`,
  };
}

export async function dispatchPostVisitSurveys() {
  // Daily cron: scan the last 24h of completed bookings.
  // Idempotent thanks to @unique on Survey.bookingId.
  const cutoffStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const cutoffEnd = new Date(Date.now() - 30 * 60 * 1000);
  const closed = await db.booking.findMany({
    where: {
      status: { in: ["COMPLETED"] },
      closedAt: { gte: cutoffStart, lte: cutoffEnd },
    },
    include: {
      guest: { select: { firstName: true, email: true } },
      venue: { select: { name: true, email: true, slug: true } },
    },
    take: 200,
  });

  const baseUrl =
    process.env.NEXTAUTH_URL ||
    `https://${process.env.VERCEL_URL || "localhost:3000"}`;

  let sent = 0;
  for (const b of closed) {
    if (!b.guest?.email) continue;
    const survey = await ensureSurveyForBooking(b.id);
    if (!survey) continue;
    if (survey.respondedAt) continue;
    const tpl = renderSurveyEmail({
      guestFirstName: b.guest.firstName,
      venueName: b.venue.name,
      link: `${baseUrl}/s/${survey.token}`,
    });
    const r = await sendEmail({
      to: { email: b.guest.email, name: b.guest.firstName },
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      replyTo: b.venue.email ?? undefined,
    });
    if (r.ok) sent++;
  }
  return { scanned: closed.length, sent };
}
