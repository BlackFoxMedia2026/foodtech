import { redirect } from "next/navigation";
import { can, getActiveVenue } from "@/lib/tenant";
import {
  generatePortalQr,
  getWifiSetup,
  routerSnippets,
} from "@/server/wifi-setup";
import { WifiSetupWizard } from "@/components/wifi/setup-wizard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function WifiSetupPage() {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "edit_marketing")) redirect("/wifi");

  const baseUrl =
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  const captiveUrl = `${baseUrl.replace(/\/$/, "")}/wifi/${ctx.venue.slug}`;

  const [setup, qrPng] = await Promise.all([
    getWifiSetup(ctx.venueId),
    generatePortalQr(captiveUrl, "png"),
  ]);

  const snippets = routerSnippets(captiveUrl);

  return (
    <div className="space-y-6 animate-fade-in">
      <header>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Wi-Fi marketing</p>
        <h1 className="text-display text-3xl">Configura il portale</h1>
        <p className="text-sm text-muted-foreground">
          Cinque step. Brand, consenso GDPR, coupon di benvenuto, QR &amp; router, test finale.
          Niente da configurare lato sviluppatore: tutto fatto da qui.
        </p>
      </header>

      <WifiSetupWizard
        initial={{
          portalLogoUrl: setup?.portalLogoUrl ?? null,
          portalAccent: setup?.portalAccent ?? null,
          portalWelcome: setup?.portalWelcome ?? null,
          portalLegal: setup?.portalLegal ?? null,
          autoCouponEnabled: setup?.autoCouponEnabled ?? false,
          autoCouponPercent: setup?.autoCouponPercent ?? 10,
          autoCouponDays: setup?.autoCouponDays ?? 30,
          setupAt: setup?.setupAt?.toISOString() ?? null,
        }}
        captiveUrl={captiveUrl}
        snippets={snippets}
        qrInitial={{ url: captiveUrl, dataUrl: qrPng as string }}
      />
    </div>
  );
}
