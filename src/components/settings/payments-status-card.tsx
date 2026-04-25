import { CheckCircle2, AlertCircle, CreditCard, Webhook, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";

export function PaymentsStatusCard({
  enabled,
  webhookConfigured,
  threshold,
  perPersonCents,
  currency,
}: {
  enabled: boolean;
  webhookConfigured: boolean;
  threshold: number;
  perPersonCents: number;
  currency: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Caparre & pagamenti (Stripe)</CardTitle>
        <CardDescription>
          Per gruppi numerosi il widget pubblico richiede una caparra prima di confermare.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Row
          icon={<CreditCard className="h-4 w-4" />}
          label="Provider Stripe"
          status={enabled ? "ok" : "warn"}
          detail={
            enabled
              ? "STRIPE_SECRET_KEY presente: i pagamenti reali sono attivi."
              : "Aggiungi STRIPE_SECRET_KEY nelle env per attivare i pagamenti."
          }
        />
        <Row
          icon={<Webhook className="h-4 w-4" />}
          label="Webhook conferma pagamento"
          status={webhookConfigured ? "ok" : "warn"}
          detail={
            webhookConfigured
              ? "STRIPE_WEBHOOK_SECRET presente: gli eventi checkout aggiornano automaticamente lo stato della prenotazione."
              : "Aggiungi STRIPE_WEBHOOK_SECRET nelle env e configura un endpoint Stripe verso /api/stripe/webhook."
          }
        />
        <Row
          icon={<Users className="h-4 w-4" />}
          label="Soglia gruppo"
          status="ok"
          detail={`Da ${threshold} persone in su · ${formatCurrency(perPersonCents, currency)} a persona.`}
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
