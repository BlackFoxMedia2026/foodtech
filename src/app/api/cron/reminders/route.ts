import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { renderReminder } from "@/emails/templates";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const now = new Date();
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

  let sent = 0;
  let skipped = 0;
  for (const b of bookings) {
    if (!b.guest?.email) {
      skipped++;
      continue;
    }
    const tpl = renderReminder({
      guest: b.guest,
      venue: b.venue,
      booking: { reference: b.reference, partySize: b.partySize, startsAt: b.startsAt, occasion: null, notes: null },
    });
    const res = await sendEmail({
      to: { email: b.guest.email, name: [b.guest.firstName, b.guest.lastName].filter(Boolean).join(" ") || undefined },
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      replyTo: b.venue.email ?? undefined,
    });
    if (res.ok) sent++;
    else skipped++;
  }

  return NextResponse.json({ window: { from: start, to: end }, scanned: bookings.length, sent, skipped });
}
