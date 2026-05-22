import Link from "next/link";
import { ExternalLink, MessagesSquare, Bot } from "lucide-react";
import { db } from "@/lib/db";
import { getActiveVenue } from "@/lib/tenant";
import { chatStats, listChatSessions } from "@/server/chat";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Stat } from "@/components/ui/stat";
import { EmptyStateRich } from "@/components/ui/empty-state-rich";
import { ExportButton } from "@/components/ui/export-button";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_META: Record<string, { label: string; tone: string }> = {
  CONVERTED: { label: "Convertita", tone: "bg-status-confirmed-soft text-status-confirmed" },
  HANDOFF: { label: "Handoff", tone: "bg-status-pending-soft text-status-pending" },
  ABANDONED: { label: "Abbandonata", tone: "bg-secondary text-secondary" },
  OPEN: { label: "Aperta", tone: "bg-status-vip-soft text-status-vip" },
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
          <p className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-tertiary">
            Growth · Conversational
          </p>
          <h1 className="text-display mt-1 text-[34px] font-medium leading-tight tracking-tight">
            Chatbot prenotazioni
          </h1>
          <p className="mt-1 text-sm text-secondary">
            Pagina pubblica e widget embeddabile per raccogliere prenotazioni in chat 24/7.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton kind="chat-sessions" label="Sessioni CSV" />
          <Link
            href={`/chat/${ctx.venue.slug}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-secondary transition-colors hover:border-border-strong hover:text-foreground"
          >
            Apri chat pubblica <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        <Stat label="Conversazioni 30gg" value={stats.total} hint="totali ricevute" emphasized />
        <Stat label="Convertite" value={stats.converted} hint="diventate prenotazioni" />
        <Stat
          label="Tasso conversione"
          value={`${stats.convRate}%`}
          hint={stats.convRate >= 30 ? "ottimo" : "migliorabile"}
          delta={
            stats.convRate >= 30
              ? { value: "ottimo", tone: "positive" }
              : { value: "basso", tone: "negative" }
          }
        />
        <Stat
          label="Handoff staff"
          value={stats.handoff}
          hint={stats.handoff > 0 ? "richieste manuali" : "tutto automatico"}
        />
      </section>

      <Panel>
        <PanelHeader
          title="Embed per il tuo sito"
          description="Incolla questo snippet prima di </body> per un pulsante chat in basso a destra."
        />
        <PanelBody className="pt-0">
          <pre className="overflow-x-auto rounded-lg bg-[hsl(var(--surface-sunken))]/50 px-3.5 py-3 font-mono text-xs text-secondary">
            {embed}
          </pre>
        </PanelBody>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Sessioni recenti" description="Ultime 50 conversazioni" />
          <PanelBody className="pt-0">
            {sessions.length === 0 ? (
              <EmptyStateRich
                size="compact"
                icon={MessagesSquare}
                title="Nessuna conversazione"
                description="Pubblica il widget sul tuo sito per ricevere richieste 24/7."
              />
            ) : (
              <ul className="divide-y divide-border">
                {sessions.map((s) => {
                  const meta = STATUS_META[s.status] ?? {
                    label: s.status,
                    tone: "bg-secondary text-secondary",
                  };
                  return (
                    <li
                      key={s.id}
                      className="flex items-center justify-between gap-2 py-2.5 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">
                          {s.draftFirstName ?? "Visitatore"}
                          {s.draftLastName ? ` ${s.draftLastName}` : ""}
                        </p>
                        <p className="text-xs text-tertiary">
                          {s.source} · {s._count.messages} messaggi ·{" "}
                          {formatDateTime(s.updatedAt)}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10.5px] font-medium",
                          meta.tone,
                        )}
                      >
                        {meta.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            title="Ultimi messaggi"
            description="Stream live: ricarica per vedere i nuovi"
          />
          <PanelBody className="pt-0">
            {recentMessages.length === 0 ? (
              <EmptyStateRich
                size="compact"
                icon={MessagesSquare}
                title="Nessun messaggio"
              />
            ) : (
              <ul className="space-y-2">
                {recentMessages.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-start gap-2 rounded-lg border border-border bg-[hsl(var(--surface-sunken))]/40 px-2.5 py-2"
                  >
                    <span
                      className={cn(
                        "grid h-7 w-7 shrink-0 place-items-center rounded-full",
                        m.role === "USER"
                          ? "bg-status-vip-soft text-status-vip"
                          : "bg-gilt/15 text-gilt-light",
                      )}
                    >
                      {m.role === "USER" ? (
                        <MessagesSquare className="h-3 w-3" />
                      ) : (
                        <Bot className="h-3 w-3" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-xs text-foreground">{m.text}</p>
                      <p className="mt-0.5 text-[10.5px] text-tertiary">
                        {m.role} · {formatDateTime(m.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </PanelBody>
        </Panel>
      </div>
    </div>
  );
}
