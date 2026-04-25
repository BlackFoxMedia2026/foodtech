import { CheckCircle2, AlertCircle, Mail, Clock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function NotificationsStatusCard({
  enabled,
  fromAddress,
  venueEmail,
}: {
  enabled: boolean;
  fromAddress: string | null;
  venueEmail: string | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifiche email</CardTitle>
        <CardDescription>
          Conferma all&apos;ospite + notifica al locale per ogni prenotazione widget. Reminder
          automatico 24h prima.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Row
          icon={<Mail className="h-4 w-4" />}
          label="Provider email (Resend)"
          status={enabled ? "ok" : "warn"}
          detail={
            enabled
              ? `Mittente: ${fromAddress}`
              : "Aggiungi RESEND_API_KEY nelle env per attivare gli invii reali."
          }
        />
        <Row
          icon={<Mail className="h-4 w-4" />}
          label="Email del locale"
          status={venueEmail ? "ok" : "warn"}
          detail={venueEmail ?? "Imposta una email sul venue per ricevere le notifiche di nuove prenotazioni."}
        />
        <Row
          icon={<Clock className="h-4 w-4" />}
          label="Reminder H-24"
          status="ok"
          detail="Cron Vercel ogni giorno alle 09:00 (UTC) → /api/cron/reminders"
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
