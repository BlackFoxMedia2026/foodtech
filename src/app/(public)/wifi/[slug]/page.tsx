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
    select: {
      id: true,
      name: true,
      slug: true,
      city: true,
      address: true,
      wifiPortalLogoUrl: true,
      wifiPortalAccent: true,
      wifiPortalWelcome: true,
      wifiPortalLegal: true,
    },
  });
  if (!venue) notFound();

  const accent = venue.wifiPortalAccent ?? "#c9a25a";
  const accentSoft = `${accent}1a`;
  const welcome =
    venue.wifiPortalWelcome ??
    "Connetti il tuo dispositivo alla nostra rete in pochi secondi.";

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 py-10">
      <header className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-carbon-800 text-sand-50 font-display text-xs">
          T
        </span>
        <span>Tavolo · Wi-Fi gratuito</span>
      </header>

      <section className="space-y-3 text-center">
        {venue.wifiPortalLogoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={venue.wifiPortalLogoUrl}
            alt={venue.name}
            className="mx-auto h-14 w-14 rounded-md object-contain"
          />
        ) : (
          <span
            className="mx-auto grid h-14 w-14 place-items-center rounded-full"
            style={{ background: accentSoft, color: accent }}
          >
            <Wifi className="h-7 w-7" />
          </span>
        )}
        <p className="text-xs uppercase tracking-[0.18em]" style={{ color: accent }}>
          Benvenuto in
        </p>
        <h1 className="text-display text-3xl leading-tight">{venue.name}</h1>
        <p className="text-sm text-muted-foreground">{welcome}</p>
      </section>

      <WifiCaptiveForm
        slug={venue.slug}
        venueName={venue.name}
        source={searchParams.src ?? null}
        legalText={venue.wifiPortalLegal}
        accent={venue.wifiPortalAccent}
      />

      <footer className="mt-auto pt-8 text-[10px] text-muted-foreground">
        Tavolo gestisce le credenziali Wi-Fi nel rispetto del GDPR. I dati restano del locale.
      </footer>
    </div>
  );
}
