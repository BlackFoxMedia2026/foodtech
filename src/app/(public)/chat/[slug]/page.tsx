import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ChatWidget } from "@/components/chat/chat-widget";
import { LocaleSwitch } from "@/components/widget/locale-switch";
import { pickLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function PublicChatPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { lang?: string };
}) {
  const venue = await db.venue.findFirst({
    where: { slug: params.slug, active: true },
    select: { id: true, name: true, slug: true, city: true },
  });
  if (!venue) notFound();
  const locale = pickLocale(searchParams.lang);

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col gap-3 px-4 py-6">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          {venue.name}
          {venue.city ? ` · ${venue.city}` : ""}
        </p>
        <LocaleSwitch locale={locale} />
      </div>
      <div className="flex-1">
        <ChatWidget venueSlug={venue.slug} venueName={venue.name} locale={locale} />
      </div>
    </div>
  );
}
