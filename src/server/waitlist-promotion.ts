import crypto from "node:crypto";
import { db } from "@/lib/db";
import { dispatchMessage } from "@/server/messages";
import { captureError } from "@/lib/observability";

// Auto-promotion: when a table opens up we offer it to the next compatible
// guest on the waitlist. The offer is a magic-link token valid for 10 min;
// the guest accepts/declines from /waitlist/offer/[token]. On expiry we
// silently promote the next candidate.

export const OFFER_TTL_MIN = 10;

export type PromotionResult = {
  ok: boolean;
  reason?: "no_candidate" | "no_contact";
  entryId?: string;
  channel?: "EMAIL" | "SMS";
};

export async function offerNextWaitlistEntry(opts: {
  venueId: string;
  partySize?: number;
}): Promise<PromotionResult> {
  // Pick the oldest WAITING entry that fits the freed party size (if known).
  const entry = await db.waitlistEntry.findFirst({
    where: {
      venueId: opts.venueId,
      status: "WAITING",
      ...(opts.partySize ? { partySize: { lte: opts.partySize } } : {}),
    },
    orderBy: { createdAt: "asc" },
  });
  if (!entry) return { ok: false, reason: "no_candidate" };
  if (!entry.email && !entry.phone) {
    // No way to reach them — promote them to NOTIFIED so the host can call.
    await db.waitlistEntry.update({
      where: { id: entry.id },
      data: { status: "NOTIFIED", notifiedAt: new Date() },
    });
    return { ok: false, reason: "no_contact", entryId: entry.id };
  }

  const token = crypto.randomBytes(18).toString("base64url");
  const expiresAt = new Date(Date.now() + OFFER_TTL_MIN * 60_000);
  const venue = await db.venue.findUnique({
    where: { id: opts.venueId },
    select: { name: true, slug: true, email: true },
  });

  const baseUrl =
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  const link = `${baseUrl.replace(/\/$/, "")}/waitlist/offer/${token}`;
  const text = `${entry.guestName.split(" ")[0]}, il tavolo per ${entry.partySize} a ${venue?.name ?? "noi"} è disponibile! Conferma entro ${OFFER_TTL_MIN} minuti: ${link}`;

  let channel: "EMAIL" | "SMS" | undefined;
  try {
    if (entry.email) {
      await dispatchMessage({
        venueId: opts.venueId,
        channel: "EMAIL",
        to: entry.email,
        subject: `${venue?.name ?? "Tavolo"} · il tuo tavolo è pronto`,
        html: `<p>Ciao ${escapeHtml(entry.guestName.split(" ")[0])},</p><p>Il tavolo per <strong>${entry.partySize}</strong> persone è libero presso <strong>${escapeHtml(venue?.name ?? "noi")}</strong>.</p><p><a href="${link}" style="display:inline-block;background:#15161a;color:#f7f4ec;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">Conferma il tavolo</a></p><p style="font-size:12px;color:#7a7466">L'offerta scade tra ${OFFER_TTL_MIN} minuti.</p>`,
        text,
        replyTo: venue?.email ?? undefined,
      });
      channel = "EMAIL";
    }
    if (entry.phone) {
      await dispatchMessage({
        venueId: opts.venueId,
        channel: "SMS",
        to: entry.phone,
        text,
      });
      channel = channel ?? "SMS";
    }
  } catch (err) {
    captureError(err, {
      module: "waitlist-promotion",
      venueId: opts.venueId,
      resourceId: entry.id,
    });
  }

  await db.waitlistEntry.update({
    where: { id: entry.id },
    data: {
      status: "OFFERED",
      offerToken: token,
      offerExpiresAt: expiresAt,
      offerSentVia: channel ?? null,
      notifiedAt: new Date(),
    },
  });

  return { ok: true, entryId: entry.id, channel };
}

export async function expireOldOffers() {
  const now = new Date();
  const expired = await db.waitlistEntry.findMany({
    where: { status: "OFFERED", offerExpiresAt: { lt: now } },
    select: { id: true, venueId: true, partySize: true },
  });
  for (const e of expired) {
    await db.waitlistEntry.update({
      where: { id: e.id },
      data: { status: "EXPIRED", offerToken: null },
    });
    // Cascade: try the next candidate automatically.
    await offerNextWaitlistEntry({ venueId: e.venueId, partySize: e.partySize }).catch(
      () => undefined,
    );
  }
  return { expired: expired.length };
}

export async function lookupOffer(token: string) {
  const entry = await db.waitlistEntry.findUnique({
    where: { offerToken: token },
    include: {
      venue: { select: { name: true, slug: true, city: true, address: true, phone: true } },
    },
  });
  if (!entry) return null;
  return entry;
}

export async function acceptOffer(token: string) {
  const entry = await db.waitlistEntry.findUnique({
    where: { offerToken: token },
    include: { venue: { select: { id: true } } },
  });
  if (!entry) throw new Error("not_found");
  if (entry.status !== "OFFERED") throw new Error("already_handled");
  if (entry.offerExpiresAt && entry.offerExpiresAt < new Date()) {
    await db.waitlistEntry.update({
      where: { id: entry.id },
      data: { status: "EXPIRED", offerToken: null },
    });
    throw new Error("expired");
  }

  // Convert the offer into an arriving booking.
  let guestId: string | null = null;
  if (entry.email || entry.phone) {
    const existing = await db.guest.findFirst({
      where: {
        venueId: entry.venueId,
        OR: [
          entry.email ? { email: entry.email } : {},
          entry.phone ? { phone: entry.phone } : {},
        ].filter((c) => Object.keys(c).length > 0),
      },
    });
    if (existing) guestId = existing.id;
    else {
      const [first, ...rest] = entry.guestName.split(" ");
      const created = await db.guest.create({
        data: {
          venueId: entry.venueId,
          firstName: first || entry.guestName,
          lastName: rest.join(" ") || null,
          email: entry.email,
          phone: entry.phone,
        },
      });
      guestId = created.id;
    }
  }
  const booking = await db.booking.create({
    data: {
      venueId: entry.venueId,
      guestId,
      partySize: entry.partySize,
      startsAt: new Date(Date.now() + 5 * 60_000),
      durationMin: 90,
      status: "CONFIRMED",
      source: "WALK_IN",
      notes: entry.notes,
    },
  });
  await db.bookingEvent.create({
    data: {
      bookingId: booking.id,
      kind: "CREATED",
      message: "Offerta waitlist accettata",
    },
  });
  await db.waitlistEntry.update({
    where: { id: entry.id },
    data: {
      status: "CONFIRMED",
      confirmedAt: new Date(),
      convertedBookingId: booking.id,
      offerToken: null,
    },
  });
  return { bookingId: booking.id, reference: booking.reference };
}

export async function declineOffer(token: string) {
  const entry = await db.waitlistEntry.findUnique({
    where: { offerToken: token },
    select: { id: true, status: true, venueId: true, partySize: true },
  });
  if (!entry) throw new Error("not_found");
  if (entry.status !== "OFFERED") throw new Error("already_handled");
  await db.waitlistEntry.update({
    where: { id: entry.id },
    data: { status: "DECLINED", declinedAt: new Date(), offerToken: null },
  });
  await offerNextWaitlistEntry({
    venueId: entry.venueId,
    partySize: entry.partySize,
  }).catch(() => undefined);
  return { ok: true };
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
