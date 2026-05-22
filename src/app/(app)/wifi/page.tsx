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
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Stat } from "@/components/ui/stat";
import { EmptyStateRich } from "@/components/ui/empty-state-rich";
import { whichWifiProvider } from "@/lib/wifi-provider";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

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
          <p className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-tertiary">
            Growth · Lead generation
          </p>
          <h1 className="text-display mt-1 text-[34px] font-medium leading-tight tracking-tight">
            Wi-Fi marketing
          </h1>
          <p className="mt-1 text-sm text-secondary">
            Cattura ospiti dalla rete del locale, arricchisci il CRM, manda coupon di benvenuto.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Link
              href="/wifi/setup"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-secondary transition-colors hover:border-border-strong hover:text-foreground"
            >
              <Settings2 className="h-3.5 w-3.5" />
              {setupDone ? "Modifica setup" : "Configura ora"}
            </Link>
          )}
          <Link
            href={`/wifi/${ctx.venue.slug}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-secondary transition-colors hover:border-border-strong hover:text-foreground"
          >
            Anteprima portale <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </header>

      {!setupDone && canEdit && (
        <div className="flex items-start gap-3 rounded-2xl border border-status-pending/30 bg-status-pending-soft/40 px-4 py-3 text-sm">
          <Settings2 className="mt-0.5 h-4 w-4 text-status-pending" />
          <div className="flex-1">
            <p className="font-medium text-status-pending">
              Portale Wi-Fi non ancora configurato
            </p>
            <p className="mt-0.5 text-xs text-status-pending/85">
              5 step: brand, consenso GDPR, coupon di benvenuto, QR &amp; router, test. Senza
              setup il portale funziona ma con valori di default.
            </p>
          </div>
          <Link
            href="/wifi/setup"
            className="inline-flex shrink-0 items-center gap-1 rounded-md bg-status-pending px-3 py-1.5 text-xs font-medium text-background hover:opacity-90"
          >
            Avvia wizard
          </Link>
        </div>
      )}

      {setupDone && setup?.autoCouponEnabled && (
        <div className="flex items-start gap-3 rounded-2xl border border-status-confirmed/30 bg-status-confirmed-soft/40 px-4 py-3 text-xs text-status-confirmed">
          <CheckCircle2 className="mt-0.5 h-4 w-4" />
          <span>
            Setup completato il {formatDateTime(setup.setupAt!)}. Coupon di benvenuto:{" "}
            <strong>{setup.autoCouponPercent}%</strong> per {setup.autoCouponDays} giorni · attivo.
          </span>
        </div>
      )}

      <section className="grid gap-3 md:grid-cols-4">
        <Stat label="Lead totali" value={stats.totalLeads} hint="dall'inizio" emphasized />
        <Stat label="Nuovi 30gg" value={stats.leads30d} hint="acquisizioni recenti" />
        <Stat label="Sessioni 30gg" value={stats.sessions30d} hint="connessioni Wi-Fi" />
        <Stat
          label="Opt-in marketing"
          value={`${stats.marketingOptInRate}%`}
          hint="conversione consenso"
          delta={
            stats.marketingOptInRate >= 60
              ? { value: "ottimo", tone: "positive" }
              : stats.marketingOptInRate >= 30
                ? undefined
                : { value: "basso", tone: "negative" }
          }
        />
      </section>

      <Panel>
        <PanelHeader
          title={
            <span className="inline-flex items-center gap-2">
              <Wifi className="h-4 w-4 text-tertiary" /> Provider hotspot
            </span>
          }
          description={
            provider === "noop"
              ? "Provider non configurato. Il portale registra il lead nel CRM ma non sblocca la rete a livello hardware."
              : "Provider HTTP attivo. A ogni connessione viene chiamato il webhook configurato per sbloccare la rete."
          }
          action={
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10.5px] font-medium",
                provider === "noop"
                  ? "bg-secondary text-secondary"
                  : "bg-gilt/15 text-gilt-light",
              )}
            >
              {provider}
            </span>
          }
        />
        {provider === "noop" && (
          <PanelBody className="pt-0 text-xs text-tertiary">
            Per integrare il router reale imposta le env{" "}
            <code className="rounded bg-secondary px-1.5 py-0.5 font-mono">WIFI_HOOK_URL</code> e
            <code className="ml-1 rounded bg-secondary px-1.5 py-0.5 font-mono">WIFI_HOOK_SECRET</code>.
            Il webhook riceverà{" "}
            <code className="rounded bg-secondary px-1.5 py-0.5 font-mono">
              {"{ leadId, venueSlug, ipAddress, userAgent }"}
            </code>{" "}
            e potrà sbloccare la rete tramite controller (Cisco Meraki, Ubiquiti, Aruba, OpenWrt…).
          </PanelBody>
        )}
      </Panel>

      <Panel>
        <PanelHeader title="Ultimi lead" description="Ordinati dal più recente" />
        <PanelBody className="pt-0">
          {leads.length === 0 ? (
            <EmptyStateRich
              icon={Wifi}
              title="Ancora nessun lead"
              description="Condividi la URL del portale o stampala come QR sulla porta del locale per iniziare a raccogliere lead."
              hint="Ogni nuovo ospite collegato diventa un guest nel CRM con consenso tracciato."
            />
          ) : (
            <ul className="divide-y divide-border text-sm">
              {leads.map((l) => (
                <li
                  key={l.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div>
                    <p className="font-medium">{l.name}</p>
                    <p className="mt-0.5 text-xs text-tertiary">
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
                    {l.consentMarketing && (
                      <span className="inline-flex items-center rounded-full bg-gilt/15 px-2.5 py-0.5 text-[10.5px] font-medium text-gilt-light">
                        opt-in
                      </span>
                    )}
                    {l.source && (
                      <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-[10.5px] font-medium text-secondary">
                        {l.source}
                      </span>
                    )}
                    <span className="text-xs text-tertiary text-numeric">
                      {formatDateTime(l.createdAt)}
                    </span>
                    {l.guestId && (
                      <Link
                        href={`/guests/${l.guestId}`}
                        className="text-xs font-medium text-secondary transition hover:text-foreground"
                      >
                        Apri scheda
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </PanelBody>
      </Panel>
    </div>
  );
}
