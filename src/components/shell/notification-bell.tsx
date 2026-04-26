"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Check, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Notif = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

const TONE: Record<string, string> = {
  BOOKING_CREATED: "bg-emerald-100 text-emerald-700",
  BOOKING_CANCELLED: "bg-rose-100 text-rose-700",
  NPS_DETRACTOR: "bg-rose-100 text-rose-700",
  WAITLIST_ACCEPTED: "bg-emerald-100 text-emerald-700",
  CONNECTOR_INBOUND: "bg-sky-100 text-sky-700",
  POS_INBOUND: "bg-amber-100 text-amber-700",
  AUTOMATION_FAILED: "bg-rose-100 text-rose-700",
  GIFT_CARD_REDEEMED: "bg-amber-100 text-amber-700",
  WIFI_LEAD: "bg-sky-100 text-sky-700",
  CHAT_HANDOFF: "bg-violet-100 text-violet-700",
  MISSED_CALL: "bg-amber-100 text-amber-700",
  REVIEW_RECEIVED: "bg-amber-100 text-amber-700",
};

function timeAgo(iso: string) {
  const then = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - then);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "ora";
  if (mins < 60) return `${mins} min fa`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} h fa`;
  const days = Math.floor(hrs / 24);
  return `${days} g fa`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const res = await fetch("/api/notifications?limit=15");
      if (!res.ok) return;
      const j = (await res.json()) as { items: Notif[]; unread: number };
      setItems(j.items);
      setUnread(j.unread);
    } catch {
      // swallow — the bell is a non-critical widget
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  // close on outside click
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  async function markRead(id: string) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, readAt: new Date().toISOString() } : it)),
    );
    setUnread((n) => Math.max(0, n - 1));
    await fetch(`/api/notifications/${id}/read`, { method: "POST" });
  }

  async function markAll() {
    setItems((prev) =>
      prev.map((it) => (it.readAt ? it : { ...it, readAt: new Date().toISOString() })),
    );
    setUnread(0);
    await fetch("/api/notifications/read-all", { method: "POST" });
  }

  return (
    <div className="relative" ref={ref}>
      <Button
        size="icon"
        variant="ghost"
        aria-label="Notifiche"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-[1rem] place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Button>
      {open && (
        <div className="absolute right-0 top-11 z-30 w-[360px] max-w-[90vw] overflow-hidden rounded-md border bg-background shadow-lg">
          <div className="flex items-center justify-between gap-2 border-b px-3 py-2 text-sm">
            <span className="font-medium">Notifiche</span>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <Button type="button" variant="ghost" size="sm" onClick={markAll}>
                  <CheckCheck className="h-3.5 w-3.5" /> Segna tutte
                </Button>
              )}
              <Button asChild variant="ghost" size="sm">
                <Link href="/notifications" onClick={() => setOpen(false)}>
                  Tutte
                </Link>
              </Button>
            </div>
          </div>
          <ul className="max-h-[60vh] divide-y overflow-y-auto">
            {items.length === 0 ? (
              <li className="px-4 py-8 text-center text-xs text-muted-foreground">
                Nessuna notifica.
              </li>
            ) : (
              items.map((it) => {
                const Tag = it.link ? Link : "div";
                return (
                  <li key={it.id} className={cn("relative", !it.readAt && "bg-secondary/30")}>
                    <Tag
                      href={it.link ?? "#"}
                      className="flex items-start gap-2 px-3 py-2 text-sm"
                      onClick={() => {
                        if (!it.readAt) void markRead(it.id);
                        setOpen(false);
                      }}
                    >
                      <span
                        className={cn(
                          "grid h-7 w-7 flex-none place-items-center rounded-full text-xs font-medium",
                          TONE[it.kind] ?? "bg-secondary text-foreground",
                        )}
                      >
                        {it.kind.charAt(0)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{it.title}</p>
                        {it.body && (
                          <p className="line-clamp-2 text-xs text-muted-foreground">{it.body}</p>
                        )}
                        <p className="text-[11px] text-muted-foreground">{timeAgo(it.createdAt)}</p>
                      </div>
                      {!it.readAt && (
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            void markRead(it.id);
                          }}
                          aria-label="Segna come letta"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </Tag>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
