import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { renderReminder } from "@/emails/templates";
import { scanScheduledTriggers } from "@/server/automations";
import { buildManageLink } from "@/server/booking-self-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Daily cron that handles three jobs in one call (Hobby plan friendly):
//  1. H-24 reminders for tomorrow's CONFIRMED/PENDING bookings
//  2. H-2 pre-visit "we're ready for you" notes for today's bookings
//  3. Birthday greetings to guests whose birthday is today (with marketing
//     opt-in to respect GDPR)

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const now = new Date();

  const tomorrow = await dispatchH24(now);
  const previsit = await dispatchH2(now);
  const birthdays = await dispatchBirthdays(now);
  await scanScheduledTriggers().catch((e) => {
    console.error("[cron:reminders] scanScheduledTriggers failed", e);
  });

  return NextResponse.json({
    h24: tomorrow,
    h2: previsit,
    birthdays,
    automations: "scanned",
  });
}

async function dispatchH24(now: Date) {
  const start = new Date(now.getTime() + 23 * 60 * 60 * 1000);
  const end = new Date(now.getTime() + 25 * 60 * 60 * 1000);
  const bookings = await db.booking.findMany({
    where: {
      startsAt: { gte: start, lte: end },
      status: { in: ["CONFIRMED", "PENDING"] },
    },
    include: {
      guest: { select: { firstName: true, lastName: true, email: true } },
      venue: { select: { name: true, city: true, address: true, phone: true, email: true } },
    },
    take: 500,
  });
  const baseUrl =
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  let sent = 0;
  for (const b of bookings) {
    if (!b.guest?.email) continue;
    const tpl = renderReminder({
      guest: b.guest,
      venue: b.venue,
      booking: {
        reference: b.reference,
        partySize: b.partySize,
        startsAt: b.startsAt,
        occasion: null,
        notes: null,
        manageUrl: buildManageLink(baseUrl, b.reference),
      },
    });
    const res = await sendEmail({
      to: { email: b.guest.email, name: [b.guest.firstName, b.guest.lastName].filter(Boolean).join(" ") || undefined },
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      replyTo: b.venue.email ?? undefined,
    });
    if (res.ok) sent++;
    if (b.guest?.email) {
      await db.bookingEvent.create({
        data: {
          bookingId: b.id,
          kind: "REMINDER_SENT",
          message: "Reminder H-24 inviato",
        },
      }).catch(() => undefined);
    }
  }
  return { scanned: bookings.length, sent };
}

async function dispatchH2(now: Date) {
  // Bookings starting in ~2h (between 1h45 and 2h15)
  const start = new Date(now.getTime() + 105 * 60 * 1000);
  const end = new Date(now.getTime() + 135 * 60 * 1000);
  const bookings = await db.booking.findMany({
    where: {
      startsAt: { gte: start, lte: end },
      status: { in: ["CONFIRMED"] },
    },
    include: {
      guest: { select: { firstName: true, lastName: true, email: true } },
      venue: { select: { name: true, city: true, address: true, phone: true, email: true } },
      events: {
        where: { kind: "REMINDER_SENT", message: { contains: "H-2" } },
        select: { id: true },
        take: 1,
      },
    },
    take: 200,
  });
  let sent = 0;
  for (const b of bookings) {
    if (!b.guest?.email) continue;
    if (b.events.length > 0) continue; // already sent
    const firstName = b.guest.firstName;
    const html = `<p>Ciao ${escapeHtml(firstName)},</p><p>tra circa 2 ore ti aspettiamo da <strong>${escapeHtml(b.venue.name)}</strong> per ${b.partySize} persone. Se hai bisogno di qualcosa, rispondi pure a questa email.</p>${
      b.venue.address || b.venue.city
        ? `<p style="color:#7a7466">📍 ${escapeHtml([b.venue.address, b.venue.city].filter(Boolean).join(" · "))}</p>`
        : ""
    }`;
    const r = await sendEmail({
      to: { email: b.guest.email, name: firstName },
      subject: `${b.venue.name} · ti aspettiamo tra poco`,
      html,
      text: `Ciao ${firstName}, tra circa 2 ore ti aspettiamo da ${b.venue.name} per ${b.partySize} persone.`,
      replyTo: b.venue.email ?? undefined,
    });
    if (r.ok) sent++;
    await db.bookingEvent.create({
      data: { bookingId: b.id, kind: "REMINDER_SENT", message: "Reminder H-2 inviato" },
    }).catch(() => undefined);
  }
  return { scanned: bookings.length, sent };
}

async function dispatchBirthdays(now: Date) {
  // We can't filter by month/day directly in Prisma without raw SQL, so we
  // scan all opted-in guests with a birthday set and filter in memory.
  const guests = await db.guest.findMany({
    where: {
      marketingOptIn: true,
      email: { not: null },
      birthday: { not: null },
    },
    include: { venue: { select: { name: true, email: true } } },
    take: 5000,
  });
  const m = now.getMonth();
  const d = now.getDate();
  const todayBdays = guests.filter(
    (g) => g.birthday && g.birthday.getMonth() === m && g.birthday.getDate() === d,
  );
  let sent = 0;
  for (const g of todayBdays) {
    if (!g.email) continue;
    const html = `<p>Buon compleanno ${escapeHtml(g.firstName)}! 🎂</p><p>Da tutto il team di <strong>${escapeHtml(g.venue.name)}</strong> auguri sinceri. Quando vuoi venire a brindare con noi, ti aspettiamo con un calice offerto dalla casa.</p>`;
    const r = await sendEmail({
      to: { email: g.email, name: g.firstName },
      subject: `🎉 Buon compleanno, ${g.firstName}!`,
      html,
      text: `Buon compleanno ${g.firstName}! Da ${g.venue.name} auguri sinceri.`,
      replyTo: g.venue.email ?? undefined,
    });
    if (r.ok) sent++;
  }
  return { scanned: todayBdays.length, sent };
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
