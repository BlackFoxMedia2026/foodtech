import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";

export const SegmentInput = z.object({
  marketingOptInOnly: z.boolean().default(true),
  loyaltyTiers: z
    .array(z.enum(["NEW", "REGULAR", "VIP", "AMBASSADOR"]))
    .optional(),
  tags: z.array(z.string()).optional(),
});

export type SegmentInputType = z.infer<typeof SegmentInput>;

export const CampaignInput = z.object({
  name: z.string().min(2).max(80),
  channel: z.enum(["EMAIL", "SMS", "WHATSAPP"]).default("EMAIL"),
  subject: z.string().max(120).optional().nullable(),
  body: z.string().min(1).max(10_000),
  segment: SegmentInput.optional(),
});

export type CampaignInputType = z.infer<typeof CampaignInput>;

export async function listCampaigns(venueId: string) {
  return db.campaign.findMany({
    where: { venueId },
    orderBy: { createdAt: "desc" },
  });
}

export async function createCampaign(venueId: string, raw: unknown) {
  const data = CampaignInput.parse(raw);
  return db.campaign.create({
    data: {
      venueId,
      name: data.name,
      channel: data.channel,
      subject: data.subject ?? null,
      body: data.body,
      segment: (data.segment ?? undefined) as Prisma.InputJsonValue | undefined,
      status: "DRAFT",
    },
  });
}

export async function updateCampaign(venueId: string, id: string, raw: unknown) {
  const existing = await db.campaign.findFirst({ where: { id, venueId } });
  if (!existing) throw new Error("not_found");
  const data = CampaignInput.partial().parse(raw);
  return db.campaign.update({
    where: { id },
    data: {
      name: data.name ?? undefined,
      channel: data.channel ?? undefined,
      subject: data.subject === undefined ? undefined : data.subject ?? null,
      body: data.body ?? undefined,
      segment:
        data.segment === undefined ? undefined : ((data.segment ?? undefined) as Prisma.InputJsonValue | undefined),
    },
  });
}

export async function deleteCampaign(venueId: string, id: string) {
  const existing = await db.campaign.findFirst({ where: { id, venueId } });
  if (!existing) throw new Error("not_found");
  await db.campaign.delete({ where: { id } });
}

export async function getCampaign(venueId: string, id: string) {
  return db.campaign.findFirst({ where: { id, venueId } });
}

export async function previewSegment(venueId: string, segment: SegmentInputType | null | undefined) {
  const guestWhere: Prisma.GuestWhereInput = { venueId, email: { not: null } };
  if (segment?.marketingOptInOnly !== false) guestWhere.marketingOptIn = true;
  if (segment?.loyaltyTiers?.length) guestWhere.loyaltyTier = { in: segment.loyaltyTiers };
  if (segment?.tags?.length) guestWhere.tags = { hasSome: segment.tags };
  return {
    total: await db.guest.count({ where: guestWhere }),
    where: guestWhere,
  };
}

export async function sendCampaign(venueId: string, id: string, fromAddress: string, baseSubject?: string) {
  const c = await db.campaign.findFirst({ where: { id, venueId }, include: { venue: true } });
  if (!c) throw new Error("not_found");
  if (c.status === "SENT") throw new Error("already_sent");
  if (c.channel !== "EMAIL") throw new Error("channel_unsupported");

  const segment = (c.segment ?? null) as SegmentInputType | null;
  const guestWhere: Prisma.GuestWhereInput = { venueId, email: { not: null } };
  if (segment?.marketingOptInOnly !== false) guestWhere.marketingOptIn = true;
  if (segment?.loyaltyTiers?.length) guestWhere.loyaltyTier = { in: segment.loyaltyTiers };
  if (segment?.tags?.length) guestWhere.tags = { hasSome: segment.tags };

  const recipients = await db.guest.findMany({
    where: guestWhere,
    select: { firstName: true, lastName: true, email: true },
    take: 1000,
  });

  let sent = 0;
  for (const g of recipients) {
    if (!g.email) continue;
    const html = renderCampaignHtml({
      venueName: c.venue.name,
      bodyMarkdown: c.body ?? "",
      firstName: g.firstName,
      fromAddress,
    });
    const subject = c.subject || baseSubject || `Novità da ${c.venue.name}`;
    const res = await sendEmail({
      to: { email: g.email, name: [g.firstName, g.lastName].filter(Boolean).join(" ") || undefined },
      subject,
      html,
      replyTo: c.venue.email ?? undefined,
    });
    if (res.ok) sent++;
  }

  await db.campaign.update({
    where: { id: c.id },
    data: {
      status: "SENT",
      sentCount: sent,
      scheduledAt: new Date(),
    },
  });

  return { sent, attempted: recipients.length };
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function paragraphsToHtml(s: string) {
  return s
    .split(/\n\s*\n/)
    .map((p) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.6">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function renderCampaignHtml(opts: { venueName: string; bodyMarkdown: string; firstName: string; fromAddress: string }) {
  const personalised = opts.bodyMarkdown.replace(/\{\{firstName\}\}/g, opts.firstName);
  return `<!doctype html>
<html lang="it"><body style="margin:0;background:#f7f4ec;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#15161a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f4ec;padding:32px 16px"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #e8e1cf;border-radius:14px;overflow:hidden">
<tr><td style="padding:24px 28px;border-bottom:1px solid #e8e1cf">
<span style="display:inline-block;width:30px;height:30px;background:#c9a25a;color:#15161a;font-weight:700;border-radius:6px;text-align:center;line-height:30px;font-family:Georgia,serif">T</span>
<span style="margin-left:10px;font-family:Georgia,serif;font-size:18px">${escapeHtml(opts.venueName)}</span>
</td></tr>
<tr><td style="padding:28px">${paragraphsToHtml(personalised)}</td></tr>
<tr><td style="padding:18px 28px;background:#fbf8ef;border-top:1px solid #e8e1cf;font-size:12px;color:#7a7466">
Ricevi questa email perché sei iscritto alla newsletter di ${escapeHtml(opts.venueName)}.
</td></tr>
</table>
</td></tr></table></body></html>`;
}
