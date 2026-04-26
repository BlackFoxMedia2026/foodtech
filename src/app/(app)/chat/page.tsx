import Link from "next/link";
import { ExternalLink, MessagesSquare, Bot } from "lucide-react";
import { db } from "@/lib/db";
import { getActiveVenue } from "@/lib/tenant";
import { chatStats, listChatSessions } from "@/server/chat";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/overview/stat-card";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, "success" | "warning" | "neutral" | "info"> = {
  CONVERTED: "success",
  HANDOFF: "warning",
  ABANDONED: "neutral",
  OPEN: "info",
};

export default async function ChatAdminPage() {
  const ctx = await getActiveVenue();
  const baseUrl =
    process.env.NEXTAUTH_URL ||
    `https://${process.env.VERCEL_URL || "localhost:3000"}`;
  const [sessions, stats] = await Promise.all([
    listChatSessions(ctx.venueId, 50),
    chatStats(ctx.venueId),
  ]);
  const recentMessages = await db.chatMessage.findMany({
    where: { session: { venueId: ctx.venueId } },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { session: { select: { id: true, status: true } } },
  });

  const embed = `<script async src="${baseUrl}/embed/chat.js" data-venue="${ctx.venue.slug}"></script>`;

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Conversational</p>
          <h1 className="text-display text-3xl">Chatbot prenotazioni</h1>
          <p className="text-sm text-muted-foreground">
            Pagina pubblica e widget embeddabile per raccogliere prenotazioni in chat 24/7.
          </p>
        </div>
        <Link
          href={`/chat/${ctx.venue.slug}`}
          target="_blank"
          className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-secondary"
        >
          Apri chat pubblica <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        <StatCard label="Conversazioni 30gg" value={String(stats.total)} emphasize />
        <StatCard label="Convertite" value={String(stats.converted)} />
        <StatCard label="Tasso conversione" value={`${stats.convRate}%`} />
        <StatCard label="Handoff staff" value={String(stats.handoff)} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Embed per il tuo sito</CardTitle>
          <CardDescription>
            Incolla questo snippet prima di <code>&lt;/body&gt;</code> per un pulsante chat in basso
            a destra.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-md bg-secondary px-3 py-2 text-xs">
            {embed}
          </pre>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sessioni recenti</CardTitle>
            <CardDescription>Ultime 50 conversazioni.</CardDescription>
          </CardHeader>
          <CardContent>
            {sessions.length === 0 ? (
              <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                Nessuna conversazione ancora. Pubblica il widget per ricevere richieste 24/7.
              </p>
            ) : (
              <ul className="divide-y text-sm">
                {sessions.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {s.draftFirstName ?? "Visitatore"}
                        {s.draftLastName ? ` ${s.draftLastName}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {s.source} · {s._count.messages} messaggi · {formatDateTime(s.updatedAt)}
                      </p>
                    </div>
                    <Badge tone={STATUS_TONE[s.status] ?? "neutral"}>{s.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ultimi messaggi</CardTitle>
            <CardDescription>Stream live: aggiorna la pagina per vedere i nuovi.</CardDescription>
          </CardHeader>
          <CardContent>
            {recentMessages.length === 0 ? (
              <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                Nessun messaggio.
              </p>
            ) : (
              <ul className="space-y-2 text-xs">
                {recentMessages.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-start gap-2 rounded-md border px-2 py-1.5"
                  >
                    <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-secondary">
                      {m.role === "USER" ? (
                        <MessagesSquare className="h-3 w-3" />
                      ) : (
                        <Bot className="h-3 w-3" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-foreground">{m.text}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {m.role} · {formatDateTime(m.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
