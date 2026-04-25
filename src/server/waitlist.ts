import { z } from "zod";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";

export const WaitlistInput = z.object({
  guestName: z.string().min(1).max(80),
  partySize: z.coerce.number().int().min(1).max(20),
  phone: z.string().max(40).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  expectedWaitMin: z.coerce.number().int().min(0).max(240).default(20),
  notes: z.string().max(300).optional().nullable(),
});

export type WaitlistInputType = z.infer<typeof WaitlistInput>;

export async function listActiveWaitlist(venueId: string) {
  const items = await db.waitlistEntry.findMany({
    where: {
      venueId,
      status: { in: ["WAITING", "NOTIFIED"] },
    },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });
  return items.map((it, i) => ({ ...it, position: i + 1 }));
}

export async function listClosedWaitlist(venueId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return db.waitlistEntry.findMany({
    where: {
      venueId,
      status: { in: ["SEATED", "CANCELLED", "NO_SHOW"] },
      updatedAt: { gte: today },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
}

export async function addToWaitlist(venueId: string, raw: unknown) {
  const data = WaitlistInput.parse(raw);
  return db.waitlistEntry.create({
    data: {
      venueId,
      guestName: data.guestName,
      partySize: data.partySize,
      phone: data.phone ?? null,
      email: data.email || null,
      expectedWaitMin: data.expectedWaitMin,
      notes: data.notes ?? null,
    },
  });
}

const StatusInput = z.object({
  status: z.enum(["WAITING", "NOTIFIED", "SEATED", "CANCELLED", "NO_SHOW"]),
});

export async function updateWaitlistEntry(venueId: string, id: string, raw: unknown) {
  const existing = await db.waitlistEntry.findFirst({ where: { id, venueId } });
  if (!existing) throw new Error("not_found");
  const merged: Record<string, unknown> = { ...((raw ?? {}) as Record<string, unknown>) };
  if (typeof merged.status === "string") {
    StatusInput.parse({ status: merged.status });
    if (merged.status === "NOTIFIED") merged.notifiedAt = new Date();
    if (merged.status === "SEATED") merged.seatedAt = new Date();
    if (merged.status === "CANCELLED") merged.cancelledAt = new Date();
  }
  if ("partySize" in merged || "expectedWaitMin" in merged || "notes" in merged) {
    WaitlistInput.partial().parse(merged);
  }
  return db.waitlistEntry.update({
    where: { id },
    data: merged as Parameters<typeof db.waitlistEntry.update>[0]["data"],
  });
}

export async function deleteWaitlistEntry(venueId: string, id: string) {
  const existing = await db.waitlistEntry.findFirst({ where: { id, venueId } });
  if (!existing) throw new Error("not_found");
  await db.waitlistEntry.delete({ where: { id } });
}

export async function notifyTableReady(venueId: string, id: string) {
  const entry = await db.waitlistEntry.findFirst({
    where: { id, venueId },
    include: { venue: { select: { name: true, email: true } } },
  });
  if (!entry) throw new Error("not_found");
  if (entry.email) {
    const html = `<!doctype html><html lang="it"><body style="margin:0;background:#f7f4ec;font-family:-apple-system,sans-serif;color:#15161a"><table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center"><table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #e8e1cf;border-radius:14px"><tr><td style="padding:28px"><p style="margin:0 0 6px;color:#7a7466;font-size:12px;letter-spacing:.16em;text-transform:uppercase">Tavolo pronto</p><h1 style="margin:0 0 14px;font-family:Georgia,serif;font-size:24px">È il tuo turno, ${escapeHtml(entry.guestName.split(" ")[0])}!</h1><p style="margin:0 0 16px;font-size:15px;line-height:1.55">Il tuo tavolo presso <strong>${escapeHtml(entry.venue.name)}</strong> è pronto. Ti aspettiamo all'ingresso.</p></td></tr></table></td></tr></table></body></html>`;
    await sendEmail({
      to: { email: entry.email, name: entry.guestName },
      subject: `${entry.venue.name} · il tuo tavolo è pronto`,
      html,
      text: `${entry.guestName.split(" ")[0]}, il tuo tavolo presso ${entry.venue.name} è pronto. Ti aspettiamo!`,
      replyTo: entry.venue.email ?? undefined,
    });
  } else {
    console.log(
      `[waitlist:noop] would notify ${entry.guestName} (no email/sms set) at ${entry.venue.name}`,
    );
  }
  return updateWaitlistEntry(venueId, id, { status: "NOTIFIED" });
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function convertToBooking(venueId: string, id: string, opts: { tableId?: string | null }) {
  const entry = await db.waitlistEntry.findFirst({ where: { id, venueId } });
  if (!entry) throw new Error("not_found");
  if (entry.status === "SEATED") throw new Error("already_seated");

  // Try to find or create a guest by phone or email
  let guestId: string | null = null;
  if (entry.email || entry.phone) {
    const found = await db.guest.findFirst({
      where: {
        venueId,
        OR: [
          entry.email ? { email: entry.email } : {},
          entry.phone ? { phone: entry.phone } : {},
        ].filter((c) => Object.keys(c).length > 0),
      },
    });
    if (found) {
      guestId = found.id;
    } else {
      const [first, ...rest] = entry.guestName.split(" ");
      const created = await db.guest.create({
        data: {
          venueId,
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
      venueId,
      guestId,
      tableId: opts.tableId ?? null,
      partySize: entry.partySize,
      startsAt: new Date(),
      durationMin: 90,
      status: "ARRIVED",
      source: "WALK_IN",
      notes: entry.notes,
      arrivedAt: new Date(),
    },
  });

  await db.bookingEvent.create({
    data: {
      bookingId: booking.id,
      kind: "CREATED",
      message: "Convertita da waiting list",
    },
  });

  await db.waitlistEntry.update({
    where: { id },
    data: { status: "SEATED", seatedAt: new Date() },
  });

  return booking;
}
