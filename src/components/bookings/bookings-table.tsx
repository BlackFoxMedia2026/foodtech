"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Booking, Guest, Table } from "@prisma/client";
import { ExternalLink, Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill, type BookingStatusKey } from "@/components/ui/status-pill";
import { formatTime, initials } from "@/lib/utils";
import { BookingDetailSheet } from "./booking-detail-sheet";

type Row = Booking & { guest: Guest | null; table: Table | null };

const SOURCE_LABELS: Record<string, string> = {
  PHONE: "Tel",
  WIDGET: "Sito",
  WALK_IN: "Walk-in",
  GOOGLE: "Google",
  SOCIAL: "Social",
  CONCIERGE: "Concierge",
  EVENT: "Evento",
};

export function BookingsTable({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Row | null>(null);

  function refresh() {
    router.refresh();
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Nessuna prenotazione"
        description="Per questa data non c'è ancora nulla in agenda."
      />
    );
  }

  return (
    <>
      <div className="panel overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-[hsl(var(--surface-sunken))]/60 text-[10.5px] font-medium uppercase tracking-[0.14em] text-tertiary">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Orario</th>
              <th className="px-4 py-3 text-left font-medium">Ospite</th>
              <th className="px-4 py-3 text-left font-medium">Persone</th>
              <th className="px-4 py-3 text-left font-medium">Tavolo</th>
              <th className="px-4 py-3 text-left font-medium">Stato</th>
              <th className="px-4 py-3 text-right font-medium">Fonte</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((b) => {
              const name = b.guest
                ? `${b.guest.firstName} ${b.guest.lastName ?? ""}`.trim()
                : "Walk-in";
              return (
                <tr
                  key={b.id}
                  onClick={() => setSelected(b)}
                  className="cursor-pointer transition-colors hover:bg-secondary/40 focus-within:bg-secondary/40"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setSelected(b);
                  }}
                >
                  <td className="px-4 py-3.5">
                    <p className="text-display text-numeric text-[15px] font-medium">
                      {formatTime(b.startsAt)}
                    </p>
                    <p className="text-[10.5px] text-tertiary">{b.durationMin} min</p>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-[10.5px]">{initials(name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{name}</p>
                        {b.guest?.phone && (
                          <p className="truncate text-xs text-tertiary">{b.guest.phone}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="inline-flex items-center gap-1 text-numeric">
                      <Users className="h-3.5 w-3.5 text-tertiary" />
                      {b.partySize}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    {b.table?.label ? (
                      <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium">
                        {b.table.label}
                      </span>
                    ) : (
                      <span className="text-xs text-tertiary">Da assegnare</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusPill status={b.status as BookingStatusKey} />
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className="text-[11px] text-tertiary">
                      {SOURCE_LABELS[b.source] ?? b.source}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <BookingDetailSheet
        booking={selected}
        onOpenChange={(o) => {
          if (!o) setSelected(null);
        }}
        onChanged={refresh}
      />
    </>
  );
}

export function OpenInPageLink({ id }: { id: string }) {
  return (
    <Button asChild variant="ghost" size="sm">
      <a href={`/bookings/${id}`}>
        <ExternalLink className="h-3.5 w-3.5" /> Apri pagina
      </a>
    </Button>
  );
}
