"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Cake,
  Crown,
  Sparkles,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials, formatTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

export type SpotlightItem = {
  bookingId: string;
  guestId: string | null;
  guestName: string;
  partySize: number;
  startsAt: string;
  tableLabel: string | null;
  reason: "vip" | "birthday" | "ambassador" | "allergy" | "anniversary";
  detail?: string | null;
};

const REASON_META: Record<
  SpotlightItem["reason"],
  { label: string; icon: LucideIcon; tone: string; iconTone: string }
> = {
  vip: {
    label: "Ospite VIP",
    icon: Crown,
    tone: "border-status-vip/30 bg-status-vip-soft/40",
    iconTone: "text-status-vip",
  },
  ambassador: {
    label: "Ambassador",
    icon: Sparkles,
    tone: "border-gilt/30 bg-gilt/10",
    iconTone: "text-gilt-dark",
  },
  birthday: {
    label: "Compleanno",
    icon: Cake,
    tone: "border-gilt/30 bg-gilt/10",
    iconTone: "text-gilt-dark",
  },
  anniversary: {
    label: "Anniversario",
    icon: Sparkles,
    tone: "border-gilt/30 bg-gilt/10",
    iconTone: "text-gilt-dark",
  },
  allergy: {
    label: "Allergie segnalate",
    icon: TriangleAlert,
    tone: "border-status-no-show/30 bg-status-no-show-soft/40",
    iconTone: "text-status-no-show",
  },
};

export function CustomerSpotlight({ items }: { items: SpotlightItem[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % items.length);
    }, 6500);
    return () => clearInterval(id);
  }, [items.length]);

  if (items.length === 0) {
    return (
      <section className="rounded-2xl border border-border bg-card p-4">
        <p className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-tertiary">
          Customer spotlight
        </p>
        <p className="mt-1 text-sm text-secondary">
          Nessun ospite speciale atteso oggi. Quando arriva un VIP o un compleanno lo vedrai qui.
        </p>
      </section>
    );
  }

  const item = items[index];
  const meta = REASON_META[item.reason];
  const Icon = meta.icon;

  return (
    <section className={cn("rounded-2xl border p-4 transition-colors", meta.tone)}>
      <header className="flex items-center justify-between">
        <p className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-tertiary">
          Customer spotlight
        </p>
        {items.length > 1 && (
          <div className="flex items-center gap-1">
            {items.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1 w-1 rounded-full transition-colors",
                  i === index ? "bg-foreground" : "bg-tertiary/40",
                )}
              />
            ))}
          </div>
        )}
      </header>

      <Link
        href={item.guestId ? `/guests/${item.guestId}` : `/bookings/${item.bookingId}`}
        className="mt-3 flex items-center gap-3"
      >
        <Avatar className="h-12 w-12">
          <AvatarFallback className="text-display text-sm">
            {initials(item.guestName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="inline-flex items-center gap-1.5 text-[15px] font-medium">
            {item.guestName}
            <Icon className={cn("h-3.5 w-3.5", meta.iconTone)} />
          </p>
          <p className="text-xs text-secondary">
            <span className="font-medium">{meta.label}</span> ·{" "}
            <span className="text-numeric">{formatTime(item.startsAt)}</span> · {item.partySize} pers
            {item.tableLabel ? ` · T${item.tableLabel}` : ""}
          </p>
          {item.detail && (
            <p className="mt-1 line-clamp-2 text-xs text-tertiary">{item.detail}</p>
          )}
        </div>
        <ArrowRight className="h-3.5 w-3.5 text-tertiary" />
      </Link>
    </section>
  );
}
