import { notFound } from "next/navigation";
import { Wifi } from "lucide-react";
import { db } from "@/lib/db";
import { WifiCaptiveForm } from "@/components/wifi/captive-form";

export const dynamic = "force-dynamic";

export default async function WifiCaptivePage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { src?: string };
}) {
  const venue = await db.venue.findFirst({
    where: { slug: params.slug, active: true },
    select: { id: true, name: true, slug: true, city: true, address: true },
  });
  if (!venue) notFound();

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 py-10">
      <header className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-carbon-800 text-sand-50 font-display text-xs">
          T
        </span>
        <span>Tavolo · Wi-Fi gratuito</span>
      </header>

      <section className="space-y-3 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-gilt/15 text-gilt-dark">
          <Wifi className="h-7 w-7" />
        </span>
        <p className="text-xs uppercase tracking-[0.18em] text-gilt-dark">Benvenuto in</p>
        <h1 className="text-display text-3xl leading-tight">{venue.name}</h1>
        <p className="text-sm text-muted-foreground">
          Connetti il tuo dispositivo alla nostra rete in pochi secondi.
        </p>
      </section>

      <WifiCaptiveForm slug={venue.slug} venueName={venue.name} source={searchParams.src ?? null} />

      <footer className="mt-auto pt-8 text-[10px] text-muted-foreground">
        Tavolo gestisce le credenziali Wi-Fi nel rispetto del GDPR. I dati restano del locale.
      </footer>
    </div>
  );
}
