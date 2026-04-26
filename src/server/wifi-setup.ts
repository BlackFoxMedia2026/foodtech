import { z } from "zod";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { submitWifiLead } from "@/server/wifi";

// Setup wizard model: branding + auto-coupon + completion timestamp.
// Saved as columns on Venue so the captive portal can read everything in one
// query without an extra join.

export const WifiSetupInput = z.object({
  portalLogoUrl: z.string().url().max(400).optional().nullable(),
  portalAccent: z
    .string()
    .regex(/^#?[0-9a-fA-F]{3,8}$/)
    .max(9)
    .optional()
    .nullable(),
  portalWelcome: z.string().max(500).optional().nullable(),
  portalLegal: z.string().max(2000).optional().nullable(),
  autoCouponEnabled: z.coerce.boolean().optional(),
  autoCouponPercent: z.coerce.number().int().min(1).max(80).optional(),
  autoCouponDays: z.coerce.number().int().min(1).max(365).optional(),
  markComplete: z.coerce.boolean().optional(),
});

export type WifiSetup = {
  portalLogoUrl: string | null;
  portalAccent: string | null;
  portalWelcome: string | null;
  portalLegal: string | null;
  autoCouponEnabled: boolean;
  autoCouponPercent: number;
  autoCouponDays: number;
  setupAt: Date | null;
};

export async function getWifiSetup(venueId: string): Promise<WifiSetup | null> {
  const v = await db.venue.findUnique({
    where: { id: venueId },
    select: {
      wifiPortalLogoUrl: true,
      wifiPortalAccent: true,
      wifiPortalWelcome: true,
      wifiPortalLegal: true,
      wifiAutoCouponEnabled: true,
      wifiAutoCouponPercent: true,
      wifiAutoCouponDays: true,
      wifiSetupAt: true,
    },
  });
  if (!v) return null;
  return {
    portalLogoUrl: v.wifiPortalLogoUrl,
    portalAccent: v.wifiPortalAccent,
    portalWelcome: v.wifiPortalWelcome,
    portalLegal: v.wifiPortalLegal,
    autoCouponEnabled: v.wifiAutoCouponEnabled,
    autoCouponPercent: v.wifiAutoCouponPercent,
    autoCouponDays: v.wifiAutoCouponDays,
    setupAt: v.wifiSetupAt,
  };
}

export async function saveWifiSetup(venueId: string, raw: unknown) {
  const data = WifiSetupInput.parse(raw);
  const accent = data.portalAccent
    ? data.portalAccent.startsWith("#")
      ? data.portalAccent
      : `#${data.portalAccent}`
    : undefined;
  const updated = await db.venue.update({
    where: { id: venueId },
    data: {
      wifiPortalLogoUrl:
        data.portalLogoUrl === undefined ? undefined : data.portalLogoUrl ?? null,
      wifiPortalAccent: accent === undefined ? undefined : accent ?? null,
      wifiPortalWelcome:
        data.portalWelcome === undefined ? undefined : data.portalWelcome ?? null,
      wifiPortalLegal:
        data.portalLegal === undefined ? undefined : data.portalLegal ?? null,
      wifiAutoCouponEnabled: data.autoCouponEnabled ?? undefined,
      wifiAutoCouponPercent: data.autoCouponPercent ?? undefined,
      wifiAutoCouponDays: data.autoCouponDays ?? undefined,
      wifiSetupAt: data.markComplete ? new Date() : undefined,
    },
    select: {
      id: true,
      wifiAutoCouponEnabled: true,
      wifiAutoCouponPercent: true,
      wifiAutoCouponDays: true,
    },
  });

  // When the operator enables the auto-coupon flag, ensure the matching
  // automation workflow exists and is active. We reuse the existing
  // WIFI_LEAD_CREATED trigger + CREATE_COUPON action so all the audit /
  // execution logging machinery picks the run up automatically.
  if (data.autoCouponEnabled !== undefined) {
    await ensureAutoCouponWorkflow(
      venueId,
      updated.wifiAutoCouponEnabled,
      updated.wifiAutoCouponPercent,
      updated.wifiAutoCouponDays,
    );
  }

  return updated;
}

const AUTO_TAG = "wifi-welcome-coupon";

async function ensureAutoCouponWorkflow(
  venueId: string,
  enabled: boolean,
  percent: number,
  days: number,
) {
  const existing = await db.automationWorkflow.findFirst({
    where: { venueId, trigger: "WIFI_LEAD_CREATED", name: { contains: AUTO_TAG } },
  });
  if (!enabled) {
    if (existing) {
      await db.automationWorkflow.update({
        where: { id: existing.id },
        data: { active: false },
      });
    }
    return;
  }
  const actions = [
    {
      kind: "CREATE_COUPON",
      params: {
        couponName: "Benvenuto Wi-Fi",
        couponKind: "PERCENT",
        couponValue: percent,
        couponDays: days,
        couponCategory: "WIFI",
      },
    },
  ];
  if (existing) {
    await db.automationWorkflow.update({
      where: { id: existing.id },
      data: {
        active: true,
        actions: actions as never,
      },
    });
    return;
  }
  await db.automationWorkflow.create({
    data: {
      venueId,
      name: `${AUTO_TAG} (auto)`,
      description:
        "Generato dal wizard Wi-Fi: rilascia un coupon di benvenuto al primo collegamento.",
      trigger: "WIFI_LEAD_CREATED",
      active: true,
      conditions: { requireConsent: true },
      actions: actions as never,
    },
  });
}

// Generates a PNG-as-data-URL of the captive portal QR code. Used by the
// wizard preview and by the /api/wifi/setup/qr download endpoint (which
// streams an SVG version too).
export async function generatePortalQr(url: string, format: "png" | "svg" = "png") {
  if (format === "svg") {
    return QRCode.toString(url, {
      type: "svg",
      margin: 1,
      color: { dark: "#15161a", light: "#ffffff" },
      width: 320,
    });
  }
  return QRCode.toDataURL(url, {
    margin: 1,
    color: { dark: "#15161a", light: "#ffffff" },
    width: 320,
  });
}

// Simulates a real captive portal submission so the operator can verify
// that the lead lands in the CRM and the auto-coupon workflow fires.
// We tag the synthesized lead so it's easy to spot in the admin list.
export async function simulateWifiLead(opts: { venueId: string; venueSlug: string }) {
  return submitWifiLead({
    venueSlug: opts.venueSlug,
    payload: {
      name: "Test Cliente",
      email: `test+${Date.now()}@${opts.venueSlug}.local`,
      phone: "",
      consentMarketing: true,
      consentPrivacy: true,
      source: "wizard-test",
    },
    ipAddress: "127.0.0.1",
    userAgent: "tavolo-wifi-wizard-test",
  });
}

export type RouterSnippet = { kind: string; label: string; code: string };

// Drop-in router config snippets the operator can copy into the captive
// portal section of their controller. They all redirect the unauthenticated
// browser to our public /wifi/[slug] page, then trust the device once the
// form is submitted (the heavy lifting happens server-side via wifiProvider).
export function routerSnippets(captiveUrl: string): RouterSnippet[] {
  const cleanUrl = captiveUrl.replace(/\/$/, "");
  return [
    {
      kind: "unifi",
      label: "UniFi Network (Hotspot 2.0)",
      code: `# Settings → Hotspot → Authentication → External portal
External portal URL: ${cleanUrl}
Redirect HTTPS:     yes
Allow before auth:  ${cleanUrl} (HTTPS)
Idle timeout:       15 min
Authentication:     Vouchers OR HTTP redirect`,
    },
    {
      kind: "mikrotik",
      label: "MikroTik / RouterOS",
      code: `# /ip hotspot walled-garden
add dst-host=${hostOf(cleanUrl)} action=allow
# /ip hotspot profile (sostituisci default)
set [find name=default] login-by=http-pap http-cookie-lifetime=1d
# Login page (uploadalo nel filesystem hotspot/login.html)
<meta http-equiv="refresh" content="0; url=${cleanUrl}?src=mt-$(hostname)" />`,
    },
    {
      kind: "openwrt",
      label: "OpenWrt + nodogsplash",
      code: `# /etc/config/nodogsplash
config nodogsplash
    option enabled '1'
    option gatewayinterface 'br-lan'
    option preauthidletimeout '300'
    option redirecturl '${cleanUrl}'
    option authidletimeout '60'`,
    },
    {
      kind: "qr",
      label: "Volantino / QR sul tavolo",
      code: `Stampa il QR generato dal wizard: punta a ${cleanUrl}.
Suggerimento: aggiungi src= con l'identificativo del tavolo o della
postazione (es. ${cleanUrl}?src=tavolo-7) per analytics più ricche.`,
    },
  ];
}

function hostOf(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
