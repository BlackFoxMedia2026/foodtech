import { z } from "zod";
import crypto from "crypto";
import { db } from "@/lib/db";
import { fireTrigger } from "@/server/automations";

export const MenuScanInput = z.object({
  menuKey: z.string().min(1).max(40).default("main"),
  source: z.enum(["QR", "TABLE", "WIDGET", "LINK"]).default("QR"),
  email: z.string().email().optional().nullable().or(z.literal("")),
  phone: z.string().min(5).max(40).optional().nullable().or(z.literal("")),
  consentMarketing: z.coerce.boolean().optional(),
  ipAddress: z.string().optional().nullable(),
  userAgent: z.string().optional().nullable(),
});

export type MenuMode = "PUBLIC" | "CONTACT" | "OPT_IN";

export function detectMenuMode(env: NodeJS.ProcessEnv = process.env): MenuMode {
  const raw = env.MENU_LEAD_MAGNET_MODE?.toUpperCase();
  if (raw === "CONTACT" || raw === "OPT_IN") return raw;
  return "PUBLIC";
}

export async function recordMenuScan(venueSlug: string, raw: unknown) {
  const data = MenuScanInput.parse(raw);
  const venue = await db.venue.findFirst({
    where: { slug: venueSlug, active: true },
    select: { id: true },
  });
  if (!venue) throw new Error("venue_not_found");

  const ipHash = data.ipAddress ? hashIp(data.ipAddress) : null;
  const email = data.email && data.email.trim() ? data.email.trim().toLowerCase() : null;
  const phone = data.phone && data.phone.trim() ? data.phone.trim() : null;

  let guestId: string | null = null;
  if (email || phone) {
    const guest = await db.guest.findFirst({
      where: {
        venueId: venue.id,
        OR: [email ? { email } : {}, phone ? { phone } : {}].filter(
          (c) => Object.keys(c).length > 0,
        ),
      },
      select: { id: true, marketingOptIn: true },
    });
    if (guest) {
      guestId = guest.id;
      if (data.consentMarketing && !guest.marketingOptIn) {
        await db.guest.update({
          where: { id: guest.id },
          data: { marketingOptIn: true },
        });
      }
    } else {
      const created = await db.guest.create({
        data: {
          venueId: venue.id,
          firstName: "Visitatore menu",
          email,
          phone,
          marketingOptIn: data.consentMarketing ?? false,
          tags: ["menu-lead"],
        },
      });
      guestId = created.id;
    }
  }

  const scan = await db.menuScan.create({
    data: {
      venueId: venue.id,
      menuKey: data.menuKey,
      source: data.source,
      ipHash,
      userAgent: data.userAgent ?? null,
      guestId,
      email,
      phone,
      consentMarketing: data.consentMarketing ?? false,
    },
  });

  if (data.consentMarketing && guestId) {
    await db.consentLog.create({
      data: {
        venueId: venue.id,
        guestId,
        channel: "MARKETING_GENERAL",
        granted: true,
        source: "menu",
        ipAddress: data.ipAddress ?? null,
        userAgent: data.userAgent ?? null,
      },
    });
  }

  if (guestId) {
    await fireTrigger("WIFI_LEAD_CREATED", {
      venueId: venue.id,
      guestId,
      payload: { kind: "menu-scan", menuKey: data.menuKey, source: data.source },
    }).catch(() => undefined);
  }

  return { scanId: scan.id, guestId };
}

export async function menuScanStats(venueId: string, days = 30) {
  const since = new Date(Date.now() - days * 86400_000);
  const [total, withContact, marketing] = await Promise.all([
    db.menuScan.count({ where: { venueId, createdAt: { gte: since } } }),
    db.menuScan.count({
      where: {
        venueId,
        createdAt: { gte: since },
        OR: [{ email: { not: null } }, { phone: { not: null } }],
      },
    }),
    db.menuScan.count({
      where: { venueId, createdAt: { gte: since }, consentMarketing: true },
    }),
  ]);
  return { total, withContact, marketing };
}

export async function listMenuScans(venueId: string, limit = 100) {
  return db.menuScan.findMany({
    where: { venueId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

function hashIp(ip: string) {
  const salt = process.env.MENU_LEAD_HASH_SALT ?? "tavolo-menu-salt";
  return crypto.createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 24);
}
