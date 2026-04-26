import Link from "next/link";
import {
  CheckCircle2,
  ExternalLink,
  Mail,
  Phone,
  Settings2,
  Smartphone,
  Wifi,
} from "lucide-react";
import { can, getActiveVenue } from "@/lib/tenant";
import { listWifiLeads, wifiStats } from "@/server/wifi";
import { getWifiSetup } from "@/server/wifi-setup";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatCard } from "@/components/overview/stat-card";
import { Badge } from "@/components/ui/badge";
import { whichWifiProvider } from "@/lib/wifi-provider";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function WifiPage() {
  const ctx = await getActiveVenue();
  const [leads, stats, setup] = await Promise.all([
    listWifiLeads(ctx.venueId),
    wifiStats(ctx.venueId),
    getWifiSetup(ctx.venueId),
  ]);
  const provider = whichWifiProvider();
  const canEdit = can(ctx.role, "edit_marketing");
  const setupDone = Boolean(setup?.setupAt);

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Marketing</p>
          <h1 className="text-display text-3xl">Wi-Fi marketing</h1>
          <p className="text-sm text-muted-foreground">
            Cattura ospiti dalla rete del locale e arricchiscili nel CRM.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Link
              href="/wifi/setup"
              className="inline-flex items-center gap-1 rounded-md border bg-background px-3 py-1.5 text-sm hover:bg-secondary"
            >
              <Settings2 className="h-3.5 w-3.5" />
              {setupDone ? "Modifica setup" : "Configura ora"}
            </Link>
          )}
          <Link
            href={`/wifi/${ctx.venue.slug}`}
            target="_blank"
            className="inline-flex items-center gap-1 rounded-md border bg-background px-3 py-1.5 text-sm hover:bg-secondary"
          >
            Anteprima portale <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </header>

      {!setupDone && canEdit && (
        <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <Settings2 className="mt-0.5 h-4 w-4" />
          <div className="flex-1">
            <p className="font-medium">Il portale Wi-Fi non è ancora configurato.</p>
            <p className="text-xs">
              Bastano 5 step: brand, consenso GDPR, coupon di benvenuto, QR &amp; router, test.
              Senza setup il portale funziona ma con valori di default.
            </p>
          </div>
          <Link
            href="/wifi/setup"
            className="inline-flex items-center gap-1 rounded-md bg-amber-900 px-3 py-1.5 text-xs font-medium text-amber-50 hover:bg-amber-800"
          >
            Avvia wizard
          </Link>
        </div>
      )}

      {setupDone && setup?.autoCouponEnabled && (
        <div className="flex items-start gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900">
          <CheckCircle2 className="mt-0.5 h-4 w-4" />
          <span>
            Setup completato il {formatDateTime(setup.setupAt!)}. Coupon di benvenuto:{" "}
            <strong>{setup.autoCouponPercent}%</strong> per {setup.autoCouponDays} giorni, attivo.
          </span>
        </div>
      )}

      <section className="grid gap-3 md:grid-cols-4">
        <StatCard label="Lead totali" value={String(stats.totalLeads)} emphasize />
        <StatCard label="Nuovi 30gg" value={String(stats.leads30d)} />
        <StatCard label="Sessioni 30gg" value={String(stats.sessions30d)} />
        <StatCard label="Opt-in marketing" value={`${stats.marketingOptInRate}%`} />
      </section>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Wifi className="h-4 w-4" /> Provider hotspot
              </CardTitle>
              <CardDescription>
                {provider === "noop"
                  ? "Provider non configurato: il portale registra il lead nel CRM ma non sblocca la rete a livello hardware."
                  : "Provider HTTP attivo: ad ogni connessione viene chiamato il webhook configurato."}
              </CardDescription>
            </div>
            <Badge tone={provider === "noop" ? "neutral" : "gold"}>{provider}</Badge>
          </div>
        </CardHeader>
        {provider === "noop" && (
          <CardContent className="text-xs text-muted-foreground">
            Per integrare il router/hotspot reale imposta le env{" "}
            <code className="rounded bg-secondary px-1">WIFI_HOOK_URL</code> e
            <code className="ml-1 rounded bg-secondary px-1">WIFI_HOOK_SECRET</code>. Il webhook
            riceverà <code className="rounded bg-secondary px-1">{`{ leadId, venueSlug, ipAddress, userAgent }`}</code>{" "}
            e potrà sbloccare la rete tramite l&apos;API del tuo controller (Cisco Meraki, Ubiquiti,
            Aruba, OpenWrt, …).
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ultimi lead</CardTitle>
          <CardDescription>Ordinati dal più recente</CardDescription>
        </CardHeader>
        <CardContent>
          {leads.length === 0 ? (
            <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              Ancora nessun lead. Condividi la URL del portale o stampala come QR sulla tua porta.
            </p>
          ) : (
            <ul className="divide-y text-sm">
              {leads.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-medium">{l.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {l.email && (
                        <span className="mr-3 inline-flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {l.email}
                        </span>
                      )}
                      {l.phone && (
                        <span className="mr-3 inline-flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {l.phone}
                        </span>
                      )}
                      {l.sessions[0]?.deviceType && (
                        <span className="inline-flex items-center gap-1">
                          <Smartphone className="h-3 w-3" /> {l.sessions[0].deviceType}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {l.consentMarketing && <Badge tone="gold">opt-in</Badge>}
                    {l.source && <Badge tone="neutral">{l.source}</Badge>}
                    <span className="text-xs text-muted-foreground">{formatDateTime(l.createdAt)}</span>
                    {l.guestId && (
                      <Link
                        href={`/guests/${l.guestId}`}
                        className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                      >
                        Apri scheda
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
