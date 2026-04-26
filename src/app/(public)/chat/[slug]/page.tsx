import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ChatWidget } from "@/components/chat/chat-widget";

export const dynamic = "force-dynamic";

export default async function PublicChatPage({ params }: { params: { slug: string } }) {
  const venue = await db.venue.findFirst({
    where: { slug: params.slug, active: true },
    select: { id: true, name: true, slug: true, city: true },
  });
  if (!venue) notFound();

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col gap-3 px-4 py-6">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">
        Chat prenotazioni · {venue.name}
        {venue.city ? ` · ${venue.city}` : ""}
      </p>
      <div className="flex-1">
        <ChatWidget venueSlug={venue.slug} venueName={venue.name} />
      </div>
    </div>
  );
}
