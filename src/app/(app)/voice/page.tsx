import { Phone, PhoneMissed, PhoneIncoming } from "lucide-react";
import { getActiveVenue, can } from "@/lib/tenant";
import {
  listCallLogs,
  listMissedCalls,
  listVoiceDrafts,
  voiceStats,
} from "@/server/voice";
import { isVoiceEnabled } from "@/lib/voice-provider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/overview/stat-card";
import { VoiceActions } from "@/components/voice/voice-actions";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const CALL_TONE: Record<string, "success" | "warning" | "danger" | "neutral" | "info"> = {
  COMPLETED: "success",
  IN_PROGRESS: "info",
  RINGING: "neutral",
  MISSED: "warning",
  FAILED: "danger",
  QUEUED: "neutral",
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
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Conversational</p>
        <h1 className="text-display text-3xl">Assistente vocale</h1>
        <p className="text-sm text-muted-foreground">
          Trascrizioni delle telefonate, bozze di prenotazione da approvare e callback automatici
          per le chiamate perse.
        </p>
      </header>

      {!enabled && (
        <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
          Provider voce non configurato: stiamo registrando in modalità simulata. Aggiungi{" "}
          <code className="rounded bg-sky-100 px-1">TWILIO_FROM_VOICE</code> (oltre alle credenziali
          Twilio) per attivare i callback reali.
        </p>
      )}

      <section className="grid gap-3 md:grid-cols-4">
        <StatCard label="Chiamate 30gg" value={String(stats.calls)} emphasize />
        <StatCard label="Perse 30gg" value={String(stats.missed)} />
        <StatCard label="Bozze in attesa" value={String(stats.drafts)} />
        <StatCard label="Convertite" value={String(stats.converted)} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Webhook provider</CardTitle>
          <CardDescription>
            Configura il tuo provider voice (Twilio Studio, Vapi, Retell…) perché POSTi le
            trascrizioni qui:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-md bg-secondary px-3 py-2 text-xs">
            {webhookUrl}
          </pre>
          <p className="mt-2 text-xs text-muted-foreground">
            Header opzionale: <code>x-voice-secret</code> uguale a{" "}
            <code>VOICE_WEBHOOK_SECRET</code>.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Bozze in attesa</CardTitle>
            <CardDescription>
              L&apos;assistente estrae i dati dalla trascrizione: tu approvi, e diventa una prenotazione.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {drafts.length === 0 ? (
              <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                Nessuna bozza in attesa.
              </p>
            ) : (
              <ul className="divide-y text-sm">
                {drafts.map((d) => (
                  <li
                    key={d.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">
                        {d.callerName ?? "Sconosciuto"}
                        {d.phone ? ` · ${d.phone}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {d.partySize ?? "?"} pax · {d.preferredDate ?? "—"} {d.preferredTime ?? ""}
                      </p>
                      {d.notes && (
                        <p className="line-clamp-2 text-xs text-muted-foreground">{d.notes}</p>
                      )}
                    </div>
                    {canManage && <VoiceActions kind="draft" id={d.id} />}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Chiamate perse</CardTitle>
            <CardDescription>
              Premi &ldquo;Richiama&rdquo; per inviare un callback al provider configurato.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {missed.length === 0 ? (
              <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                Nessuna chiamata persa pendente.
              </p>
            ) : (
              <ul className="divide-y text-sm">
                {missed.map((m) => (
                  <li
                    key={m.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <PhoneMissed className="h-4 w-4 text-amber-600" />
                      <div>
                        <p className="font-medium">{m.fromNumber}</p>
                        <p className="text-xs text-muted-foreground">
                          {m.attempts} tentativi · {formatDateTime(m.createdAt)}
                        </p>
                      </div>
                    </div>
                    {canManage && <VoiceActions kind="missed" id={m.id} />}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registro chiamate</CardTitle>
          <CardDescription>Ultime 30 chiamate con stato, durata e trascrizione.</CardDescription>
        </CardHeader>
        <CardContent>
          {calls.length === 0 ? (
            <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              Nessuna chiamata registrata.
            </p>
          ) : (
            <ul className="divide-y text-sm">
              {calls.map((c) => (
                <li key={c.id} className="flex flex-wrap items-start justify-between gap-2 py-2">
                  <div className="flex items-start gap-2">
                    {c.direction === "INBOUND" ? (
                      <PhoneIncoming className="mt-1 h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Phone className="mt-1 h-4 w-4 text-muted-foreground" />
                    )}
                    <div className="min-w-0">
                      <p className="font-medium">{c.fromNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.intent ?? "—"} · {c.durationSec ? `${c.durationSec}s · ` : ""}
                        {formatDateTime(c.createdAt)}
                      </p>
                      {c.transcript && (
                        <p className="line-clamp-2 max-w-prose text-xs text-muted-foreground">
                          {c.transcript}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge tone={CALL_TONE[c.status] ?? "neutral"}>{c.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
