import { ScanClient } from "@/components/events/scan-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default function EventsScanPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <header>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Eventi</p>
        <h1 className="text-display text-3xl">Check-in ticket</h1>
        <p className="text-sm text-muted-foreground">
          Inserisci o incolla l&apos;ID del ticket. Il QR del cliente codifica direttamente l&apos;ID
          (puoi leggerlo con qualsiasi scanner).
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Convalida ticket</CardTitle>
          <CardDescription>L&apos;auto-submit parte dopo 1 secondo dall&apos;ultimo carattere.</CardDescription>
        </CardHeader>
        <CardContent>
          <ScanClient />
        </CardContent>
      </Card>
    </div>
  );
}
