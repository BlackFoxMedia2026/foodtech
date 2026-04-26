import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { sendMessage } from "@/lib/messaging";

type Channel = "EMAIL" | "SMS" | "WHATSAPP";

export type DispatchInput = {
  venueId: string;
  channel: Channel;
  to: string;            // email or phone
  subject?: string;      // email only
  html?: string;         // email only
  text: string;          // plain text body (used for SMS/WA, also fallback for email)
  replyTo?: string;
  guestId?: string;
  campaignId?: string;
  workflowRunId?: string;
};

export async function dispatchMessage(input: DispatchInput) {
  const log = await db.messageLog.create({
    data: {
      venueId: input.venueId,
      channel: input.channel,
      toAddress: input.to,
      subject: input.subject ?? null,
      bodyPreview: input.text.slice(0, 200),
      status: "QUEUED",
      campaignId: input.campaignId ?? null,
      guestId: input.guestId ?? null,
      workflowRunId: input.workflowRunId ?? null,
    },
  });

  try {
    if (input.channel === "EMAIL") {
      const res = await sendEmail({
        to: { email: input.to },
        subject: input.subject ?? "(senza oggetto)",
        html: input.html ?? `<p>${escapeHtml(input.text).replace(/\n/g, "<br>")}</p>`,
        text: input.text,
        replyTo: input.replyTo,
      });
      if (res.ok) {
        await db.messageLog.update({
          where: { id: log.id },
          data: { status: "SENT", providerId: res.id, sentAt: new Date() },
        });
      } else if (res.reason === "no_api_key") {
        await db.messageLog.update({
          where: { id: log.id },
          data: { status: "SKIPPED", error: "no_api_key", failedAt: new Date() },
        });
      } else {
        await db.messageLog.update({
          where: { id: log.id },
          data: { status: "FAILED", error: res.error ?? "send_error", failedAt: new Date() },
        });
      }
    } else {
      // SMS or WHATSAPP via messaging adapter
      const res = await sendMessage({ to: input.to, body: input.text, channel: input.channel });
      if (res.ok) {
        await db.messageLog.update({
          where: { id: log.id },
          data: { status: "SENT", providerId: res.id, sentAt: new Date() },
        });
      } else if (res.reason === "no_provider") {
        await db.messageLog.update({
          where: { id: log.id },
          data: { status: "SKIPPED", error: "no_provider", failedAt: new Date() },
        });
      } else {
        await db.messageLog.update({
          where: { id: log.id },
          data: { status: "FAILED", error: res.error ?? "send_error", failedAt: new Date() },
        });
      }
    }
  } catch (err) {
    await db.messageLog.update({
      where: { id: log.id },
      data: {
        status: "FAILED",
        error: err instanceof Error ? err.message : String(err),
        failedAt: new Date(),
      },
    });
  }

  return log.id;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function recentMessageLogs(venueId: string, limit = 100) {
  return db.messageLog.findMany({
    where: { venueId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      campaign: { select: { name: true } },
      guest: { select: { firstName: true, lastName: true } },
    },
  });
}

export async function messageLogStats(venueId: string) {
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const groups = await db.messageLog.groupBy({
    by: ["channel", "status"],
    where: { venueId, createdAt: { gte: since } },
    _count: { _all: true },
  });
  return groups.map((g) => ({
    channel: g.channel,
    status: g.status,
    count: g._count._all,
  }));
}

// Helper: check the latest consent for guest+channel via ConsentLog (most recent
// row wins) and fall back to legacy Guest.marketingOptIn for the EMAIL channel
// when no log exists.
export async function hasConsent(
  guestId: string,
  channel: "EMAIL" | "SMS" | "WHATSAPP",
): Promise<boolean> {
  const map: Record<string, "EMAIL" | "SMS" | "WHATSAPP"> = {
    EMAIL: "EMAIL",
    SMS: "SMS",
    WHATSAPP: "WHATSAPP",
  };
  const log = await db.consentLog.findFirst({
    where: { guestId, channel: map[channel] },
    orderBy: { createdAt: "desc" },
    select: { granted: true },
  });
  if (log) return log.granted;
  // Legacy fallback: marketingOptIn covers EMAIL by default
  if (channel === "EMAIL") {
    const guest = await db.guest.findUnique({
      where: { id: guestId },
      select: { marketingOptIn: true },
    });
    return Boolean(guest?.marketingOptIn);
  }
  return false;
}
