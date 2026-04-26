"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Message = { id: string; role: "USER" | "BOT"; text: string };

type Bot = {
  reply: string;
  intent: string;
  quickReplies?: string[];
  status: "OPEN" | "CONVERTED" | "HANDOFF";
  bookingReference?: string;
};

export function ChatWidget({
  venueSlug,
  venueName,
}: {
  venueSlug: string;
  venueName: string;
}) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [closed, setClosed] = useState(false);
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let aborted = false;
    (async () => {
      const res = await fetch(`/api/chat/${venueSlug}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source: "WEB" }),
      });
      if (!res.ok || aborted) return;
      const data = (await res.json()) as { sessionId: string; bot: Bot };
      setSessionId(data.sessionId);
      setMessages([{ id: "0", role: "BOT", text: data.bot.reply }]);
      setQuickReplies(data.bot.quickReplies ?? []);
    })();
    return () => {
      aborted = true;
    };
  }, [venueSlug]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    if (!sessionId || !text.trim() || busy || closed) return;
    setBusy(true);
    const userMsg: Message = { id: `u-${Date.now()}`, role: "USER", text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setQuickReplies([]);
    const res = await fetch(`/api/chat/sessions/${sessionId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    setBusy(false);
    if (!res.ok) {
      setMessages((prev) => [
        ...prev,
        {
          id: `b-${Date.now()}`,
          role: "BOT",
          text: "Mi spiace, c'è stato un errore. Vuoi riprovare?",
        },
      ]);
      return;
    }
    const data = (await res.json()) as Bot;
    setMessages((prev) => [
      ...prev,
      { id: `b-${Date.now()}`, role: "BOT", text: data.reply },
    ]);
    setQuickReplies(data.quickReplies ?? []);
    if (data.status !== "OPEN") setClosed(true);
  }

  return (
    <div className="flex h-full flex-col rounded-2xl border bg-background">
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-gilt/10 text-gilt-dark">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="font-medium leading-tight">{venueName}</p>
          <p className="text-xs text-muted-foreground">Assistente prenotazioni</p>
        </div>
      </header>

      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-3 text-sm">
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "max-w-[85%] rounded-2xl px-3 py-2",
              m.role === "USER"
                ? "ml-auto bg-carbon-800 text-sand-50"
                : "bg-secondary text-foreground",
            )}
          >
            {m.text}
          </div>
        ))}
        {busy && (
          <div className="bg-secondary text-muted-foreground max-w-[60%] rounded-2xl px-3 py-2 text-xs italic">
            …sto scrivendo
          </div>
        )}
      </div>

      {quickReplies.length > 0 && !closed && (
        <div className="flex flex-wrap gap-1.5 border-t px-3 py-2">
          {quickReplies.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => send(q)}
              className="rounded-full border bg-background px-2.5 py-1 text-xs hover:bg-secondary"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 border-t px-3 py-2"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={closed ? "Conversazione chiusa" : "Scrivi un messaggio…"}
          disabled={busy || closed}
          maxLength={500}
        />
        <Button type="submit" size="icon" variant="gold" disabled={busy || closed}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
