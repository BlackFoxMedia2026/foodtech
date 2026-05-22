import { Phone, PhoneMissed, PhoneIncoming } from "lucide-react";
import { getActiveVenue, can } from "@/lib/tenant";
import {
  listCallLogs,
  listMissedCalls,
  listVoiceDrafts,
  voiceStats,
} from "@/server/voice";
import { isVoiceEnabled } from "@/lib/voice-provider";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Stat } from "@/components/ui/stat";
import { EmptyStateRich } from "@/components/ui/empty-state-rich";
import { VoiceActions } from "@/components/voice/voice-actions";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const CALL_META: Record<string, { label: string; tone: string }> = {
  COMPLETED: { label: "Completata", tone: "bg-status-confirmed-soft text-status-confirmed" },
  IN_PROGRESS: { label: "In corso", tone: "bg-status-vip-soft text-status-vip" },
  RINGING: { label: "Squilla", tone: "bg-secondary text-secondary" },
  MISSED: { label: "Persa", tone: "bg-status-pending-soft text-status-pending" },
  FAILED: { label: "Errore", tone: "bg-status-no-show-soft text-status-no-show" },
  QUEUED: { label: "In coda", tone: "bg-secondary text-secondary" },
};

export default async function VoiceAdminPage() {
  const ctx = await getActiveVenue();
  const canManage = can(ctx.role, "manage_bookings");
  const baseUrl =
    process.env.NEXTAUTH_URL ||
    `https://${process.env.VERCEL_URL || "localhost:3000"}`;
  const [calls, drafts, missed, stats] = await Promise.all([
    listCallLogs(ctx.venueId, 30),
    listVoiceDrafts(ctx.venueId),
    listMissedCalls(ctx.venueId),
    voiceStats(ctx.venueId),
  ]);
  const enabled = isVoiceEnabled();
  const webhookUrl = `${baseUrl}/api/voice/${ctx.venue.slug}`;

  return (
    <div className="space-y-6 animate-fade-in">
      <header>
        <p className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-tertiary">
          Growth · Conversational
        </p>
        <h1 className="text-display mt-1 text-[34px] font-medium leading-tight tracking-tight">
          Assistente vocale
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-secondary">
          Trascrizioni delle telefonate, bozze di prenotazione da approvare e callback automatici
          per le chiamate perse.
        </p>
      </header>

      {!enabled && (
        <div className="rounded-2xl border border-status-vip/30 bg-status-vip-soft/40 px-4 py-3 text-sm text-status-vip">
          <p className="font-medium">Provider voce non configurato (modalità simulata)</p>
          <p className="mt-0.5 text-xs">
            Aggiungi{" "}
            <code className="rounded bg-status-vip/15 px-1.5 py-0.5 font-mono">TWILIO_FROM_VOICE</code>{" "}
            (e le credenziali Twilio) per attivare i callback reali.
          </p>
        </div>
      )}

      <section className="grid gap-3 md:grid-cols-4">
        <Stat label="Chiamate 30gg" value={stats.calls} hint="totali ricevute" emphasized />
        <Stat
          label="Perse 30gg"
          value={stats.missed}
          hint={stats.missed > 0 ? "richiede callback" : "tutte risposte"}
          delta={
            stats.missed > 0
              ? { value: "follow-up", tone: "negative" }
              : { value: "ok", tone: "positive" }
          }
        />
        <Stat label="Bozze in attesa" value={stats.drafts} hint="da approvare" />
        <Stat label="Convertite" value={stats.converted} hint="in prenotazione" />
      </section>

      <Panel>
        <PanelHeader
          title="Webhook provider"
          description="Configura il tuo provider voce (Twilio Studio, Vapi, Retell...) perché POST le trascrizioni qui."
        />
        <PanelBody className="pt-0">
          <pre className="overflow-x-auto rounded-lg bg-[hsl(var(--surface-sunken))]/50 px-3.5 py-3 font-mono text-xs text-secondary">
            {webhookUrl}
          </pre>
          <p className="mt-2 text-xs text-tertiary">
            Header opzionale:{" "}
            <code className="rounded bg-secondary px-1.5 py-0.5 font-mono">x-voice-secret</code>{" "}
            uguale a{" "}
            <code className="rounded bg-secondary px-1.5 py-0.5 font-mono">VOICE_WEBHOOK_SECRET</code>.
          </p>
        </PanelBody>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Bozze in attesa"
            description="L'assistente estrae i dati dalla trascrizione: tu approvi e diventa prenotazione."
          />
          <PanelBody className="pt-0">
            {drafts.length === 0 ? (
              <EmptyStateRich
                size="compact"
                icon={Phone}
                title="Nessuna bozza"
                description="Le bozze compaiono qui quando il webhook riceve una trascrizione."
              />
            ) : (
              <ul className="divide-y divide-border text-sm">
                {drafts.map((d) => (
                  <li
                    key={d.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">
                        {d.callerName ?? "Sconosciuto"}
                        {d.phone && (
                          <span className="ml-2 text-tertiary">{d.phone}</span>
                        )}
                      </p>
                      <p className="text-xs text-tertiary">
                        {d.partySize ?? "?"} pax · {d.preferredDate ?? "—"}{" "}
                        {d.preferredTime ?? ""}
                      </p>
                      {d.notes && (
                        <p className="line-clamp-2 text-xs text-tertiary italic">
                          {d.notes}
                        </p>
                      )}
                    </div>
                    {canManage && <VoiceActions kind="draft" id={d.id} />}
                  </li>
                ))}
              </ul>
            )}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            title="Chiamate perse"
            description="Premi Richiama per inviare un callback al provider configurato."
          />
          <PanelBody className="pt-0">
            {missed.length === 0 ? (
              <EmptyStateRich
                size="compact"
                icon={PhoneMissed}
                title="Nessuna chiamata persa"
                description="Tutto sotto controllo."
              />
            ) : (
              <ul className="divide-y divide-border text-sm">
                {missed.map((m) => (
                  <li
                    key={m.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-status-pending-soft text-status-pending">
                        <PhoneMissed className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="font-medium">{m.fromNumber}</p>
                        <p className="text-xs text-tertiary">
                          {m.attempts} tentativi · {formatDateTime(m.createdAt)}
                        </p>
                      </div>
                    </div>
                    {canManage && <VoiceActions kind="missed" id={m.id} />}
                  </li>
                ))}
              </ul>
            )}
          </PanelBody>
        </Panel>
      </div>

      <Panel>
        <PanelHeader
          title="Registro chiamate"
          description="Ultime 30 chiamate con stato, durata e trascrizione."
        />
        <PanelBody className="pt-0">
          {calls.length === 0 ? (
            <EmptyStateRich
              size="compact"
              icon={Phone}
              title="Nessuna chiamata registrata"
              description="Le chiamate compaiono qui quando il webhook riceve eventi."
            />
          ) : (
            <ul className="divide-y divide-border text-sm">
              {calls.map((c) => {
                const meta = CALL_META[c.status] ?? {
                  label: c.status,
                  tone: "bg-secondary text-secondary",
                };
                return (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-start justify-between gap-3 py-3"
                  >
                    <div className="flex items-start gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[hsl(var(--surface-sunken))] text-tertiary">
                        {c.direction === "INBOUND" ? (
                          <PhoneIncoming className="h-4 w-4" />
                        ) : (
                          <Phone className="h-4 w-4" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium">{c.fromNumber}</p>
                        <p className="text-xs text-tertiary">
                          {c.intent ?? "—"} · {c.durationSec ? `${c.durationSec}s · ` : ""}
                          {formatDateTime(c.createdAt)}
                        </p>
                        {c.transcript && (
                          <p className="line-clamp-2 max-w-prose text-xs italic text-tertiary">
                            {c.transcript}
                          </p>
                        )}
                      </div>
                    </div>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10.5px] font-medium",
                        meta.tone,
                      )}
                    >
                      {meta.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </PanelBody>
      </Panel>
    </div>
  );
}
