import { CheckCircle2, AlertCircle, MessageSquare, BrainCircuit } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function IntegrationsCard({
  twilio,
  ai,
}: {
  twilio: { enabled: boolean; smsFrom?: string | null; waFrom?: string | null };
  ai: { enabled: boolean; provider: string };
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Integrazioni avanzate</CardTitle>
        <CardDescription>
          SMS/WhatsApp e suggerimenti AI funzionano in modalità no-op finché non aggiungi le chiavi.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Row
          icon={<MessageSquare className="h-4 w-4" />}
          label="Twilio (SMS/WhatsApp)"
          status={twilio.enabled ? "ok" : "warn"}
          detail={
            twilio.enabled
              ? `SMS from: ${twilio.smsFrom || "—"} · WhatsApp from: ${twilio.waFrom || "—"}`
              : "Aggiungi TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_SMS, TWILIO_FROM_WHATSAPP per attivare l'invio reale."
          }
        />
        <Row
          icon={<BrainCircuit className="h-4 w-4" />}
          label="Suggerimenti AI"
          status={ai.enabled ? "ok" : "warn"}
          detail={
            ai.enabled
              ? `Provider: ${ai.provider}. Brief operativo generato da modello esterno.`
              : "Provider euristico locale attivo. Aggiungi OPENAI_API_KEY o ANTHROPIC_API_KEY per LLM avanzati."
          }
        />
      </CardContent>
    </Card>
  );
}

function Row({
  icon,
  label,
  status,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  status: "ok" | "warn";
  detail: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border p-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-muted-foreground">{icon}</span>
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{detail}</p>
        </div>
      </div>
      {status === "ok" ? (
        <Badge tone="gold" className="gap-1">
          <CheckCircle2 className="h-3 w-3" /> Attivo
        </Badge>
      ) : (
        <Badge tone="neutral" className="gap-1">
          <AlertCircle className="h-3 w-3" /> Da configurare
        </Badge>
      )}
    </div>
  );
}
