"use client";

import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, Users } from "lucide-react";
import type { Guest } from "@prisma/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { LoyaltyPill, type LoyaltyKey } from "@/components/ui/status-pill";
import { formatCurrency, formatDate, initials } from "@/lib/utils";

export function GuestsTable({ rows }: { rows: Guest[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  function onSearch(q: string) {
    const sp = new URLSearchParams(search);
    if (q) sp.set("q", q);
    else sp.delete("q");
    router.push(`${pathname}?${sp.toString()}`);
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-tertiary" />
        <input
          defaultValue={search.get("q") ?? ""}
          placeholder="Cerca per nome, email o telefono…"
          onChange={(e) => onSearch(e.target.value)}
          className="h-10 w-full rounded-lg border border-border bg-card pl-10 pr-3 text-sm transition-colors placeholder:text-tertiary focus:border-border-strong focus:outline-none"
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nessun ospite trovato"
          description="Prova con un nome, telefono o email diversi, oppure cambia segmento."
        />
      ) : (
        <div className="panel overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-[hsl(var(--surface-sunken))]/60 text-[10.5px] font-medium uppercase tracking-[0.14em] text-tertiary">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Ospite</th>
                <th className="px-4 py-3 text-left font-medium">Contatti</th>
                <th className="px-4 py-3 text-right font-medium">Visite</th>
                <th className="px-4 py-3 text-right font-medium">Spesa totale</th>
                <th className="px-4 py-3 text-left font-medium">Ultima visita</th>
                <th className="px-4 py-3 text-left font-medium">Fedeltà</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((g) => {
                const name = `${g.firstName} ${g.lastName ?? ""}`.trim();
                const totalSpendCents = Math.round(Number(g.totalSpend) * 100);
                return (
                  <tr
                    key={g.id}
                    className="cursor-pointer transition-colors hover:bg-secondary/40"
                    onClick={() => router.push(`/guests/${g.id}`)}
                  >
                    <td className="px-4 py-3.5">
                      <Link
                        href={`/guests/${g.id}`}
                        className="flex items-center gap-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Avatar className="h-9 w-9">
                          <AvatarFallback>{initials(name)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{name}</p>
                          {g.tags?.length > 0 && (
                            <div className="mt-0.5 flex flex-wrap gap-1">
                              {g.tags.slice(0, 3).map((t) => (
                                <span
                                  key={t}
                                  className="inline-flex items-center rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-secondary"
                                >
                                  {t}
                                </span>
                              ))}
                              {g.tags.length > 3 && (
                                <span className="text-[10px] text-tertiary">
                                  +{g.tags.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="truncate text-foreground">{g.email ?? "—"}</p>
                      {g.phone && <p className="truncate text-xs text-tertiary">{g.phone}</p>}
                    </td>
                    <td className="px-4 py-3.5 text-right text-numeric font-medium">
                      {g.totalVisits}
                    </td>
                    <td className="px-4 py-3.5 text-right text-numeric font-medium">
                      {totalSpendCents > 0 ? formatCurrency(totalSpendCents) : "—"}
                    </td>
                    <td className="px-4 py-3.5 text-tertiary">
                      {g.lastVisitAt ? formatDate(g.lastVisitAt) : "—"}
                    </td>
                    <td className="px-4 py-3.5">
                      <LoyaltyPill loyalty={g.loyaltyTier as LoyaltyKey} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
