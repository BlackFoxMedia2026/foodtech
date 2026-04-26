"use client";

import { Download, QrCode } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function TableQrCard({
  tables,
}: {
  tables: { id: string; label: string; seats: number }[];
}) {
  if (tables.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-4 w-4" /> QR ordering al tavolo
          </CardTitle>
          <CardDescription>
            Quando avrai aggiunto i tavoli dalla pagina Sala, qui troverai i QR da
            stampare.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-4 w-4" /> QR ordering al tavolo
        </CardTitle>
        <CardDescription>
          Stampa il QR sul tavolo: il guest scansiona, vede il menu, manda l&apos;ordine in
          cucina senza chiamare il cameriere. Pagamento al tavolo a fine servizio.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-2 sm:grid-cols-2">
          {tables.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium">{t.label}</p>
                <p className="text-xs text-muted-foreground">{t.seats} posti</p>
              </div>
              <Button asChild variant="outline" size="sm">
                <a href={`/api/tables/${t.id}/qr?format=svg`} download>
                  <Download className="h-3.5 w-3.5" /> SVG
                </a>
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
