import { z } from "zod";
import { db } from "@/lib/db";
import { wifiProvider } from "@/lib/wifi-provider";
import { fireTrigger } from "@/server/automations";

export const WifiSubmitInput = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().min(5).max(40).optional().or(z.literal("")),
  consentMarketing: z.coerce.boolean().default(false),
  consentPrivacy: z.coerce.boolean(),
  source: z.string().max(120).optional().nullable(),
});

export type WifiSubmitInputType = z.infer<typeof WifiSubmitInput>;

export async function listWifiLeads(venueId: string, limit = 200) {
  return db.wifiLead.findMany({
    where: { venueId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { sessions: { take: 1, orderBy: { startedAt: "desc" } } },
  });
}

export async function wifiStats(venueId: string) {
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const [total, last30, marketingOptIn, returning] = await Promise.all([
    db.wifiLead.count({ where: { venueId } }),
    db.wifiLead.count({ where: { venueId, createdAt: { gte: since } } }),
    db.wifiLead.count({ where: { venueId, consentMarketing: true } }),
    db.wifiSession.groupBy({
      by: ["leadId"],
      where: { venueId },
      _count: { _all: true },
      having: { leadId: { _count: { gt: 1 } } },
    }),
  ]);
  const sessions30 = await db.wifiSession.count({
    where: { venueId, startedAt: { gte: since } },
  });
  return {
    totalLeads: total,
    leads30d: last30,
    marketingOptInRate: total > 0 ? Math.round((marketingOptIn / total) * 100) : 0,
    sessions30d: sessions30,
    returningLeads: returning.length,
  };
}

export async function submitWifiLead(opts: {
  venueSlug: string;
  payload: unknown;
  ipAddress: string | null;
  userAgent: string | null;
}) {
  const data = WifiSubmitInput.parse(opts.payload);
  if (!data.consentPrivacy) throw new Error("privacy_required");
  if (!data.email && !data.phone) throw new Error("contact_required");

  const venue = await db.venue.findFirst({
    where: { slug: opts.venueSlug, active: true },
    select: { id: true },
  });
  if (!venue) throw new Error("venue_not_found");

  // Find or create the linked Guest in the CRM
  const email = data.email ? data.email.trim().toLowerCase() : null;
  const phone = data.phone ? data.phone.trim() : null;

  let guest = email || phone
    ? await db.guest.findFirst({
        where: {
          venueId: venue.id,
          OR: [
            email ? { email } : {},
            phone ? { phone } : {},
          ].filter((c) => Object.keys(c).length > 0),
        },
      })
    : null;

  if (!guest) {
    const [first, ...rest] = data.name.split(" ");
    guest = await db.guest.create({
      data: {
        venueId: venue.id,
        firstName: first || data.name,
        lastName: rest.join(" ") || null,
        email,
        phone,
        marketingOptIn: data.consentMarketing,
        tags: ["wifi-lead"],
      },
    });
  } else {
    // Add the wifi-lead tag if missing, and refresh the marketing opt-in if user
    // freshly granted it (we don't revoke automatically — revocation needs an
    // explicit ConsentLog with granted=false).
    const tags = guest.tags.includes("wifi-lead") ? guest.tags : [...guest.tags, "wifi-lead"];
    guest = await db.guest.update({
      where: { id: guest.id },
      data: {
        tags,
        marketingOptIn: data.consentMarketing || guest.marketingOptIn,
        email: email ?? guest.email,
        phone: phone ?? guest.phone,
      },
    });
  }

  const lead = await db.wifiLead.create({
    data: {
      venueId: venue.id,
      guestId: guest.id,
      name: data.name,
      email,
      phone,
      source: data.source ?? null,
      ipAddress: opts.ipAddress,
      userAgent: opts.userAgent,
      consentMarketing: data.consentMarketing,
      consentPrivacy: data.consentPrivacy,
    },
  });

  // Audit consent in a dedicated log so the operator has GDPR proof
  await db.consentLog.createMany({
    data: [
      {
        venueId: venue.id,
        guestId: guest.id,
        leadId: lead.id,
        channel: "PRIVACY",
        granted: data.consentPrivacy,
        source: "wifi",
        ipAddress: opts.ipAddress,
        userAgent: opts.userAgent,
      },
      {
        venueId: venue.id,
        guestId: guest.id,
        leadId: lead.id,
        channel: "MARKETING_GENERAL",
        granted: data.consentMarketing,
        source: "wifi",
        ipAddress: opts.ipAddress,
        userAgent: opts.userAgent,
      },
    ],
  });

  // Open a session in the database, regardless of provider — useful for stats.
  const session = await db.wifiSession.create({
    data: {
      leadId: lead.id,
      venueId: venue.id,
      ipAddress: opts.ipAddress,
      userAgent: opts.userAgent,
      deviceType: detectDevice(opts.userAgent),
    },
  });

  // Optional hardware grant — best effort
  const grant = await wifiProvider().grantAccess({
    leadId: lead.id,
    venueSlug: opts.venueSlug,
    ipAddress: opts.ipAddress,
    userAgent: opts.userAgent,
  });

  await fireTrigger("WIFI_LEAD_CREATED", {
    venueId: venue.id,
    guestId: guest.id,
    payload: { leadId: lead.id, source: data.source ?? null },
  }).catch(() => undefined);

  return { leadId: lead.id, sessionId: session.id, guestId: guest.id, grant };
}

function detectDevice(userAgent: string | null): string | null {
  if (!userAgent) return null;
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet/.test(ua)) return "tablet";
  if (/iphone|android|mobile|phone/.test(ua)) return "mobile";
  return "desktop";
}
