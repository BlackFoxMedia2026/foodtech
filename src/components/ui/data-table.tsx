"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

export type Column<T> = {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  sortable?: boolean;
  align?: "left" | "right" | "center";
  width?: string;
  sortValue?: (row: T) => string | number | Date | null | undefined;
  hideOn?: "sm" | "md";
};

export function DataTable<T extends { id: string }>({
  rows,
  columns,
  onRowClick,
  emptyState,
  className,
}: {
  rows: T[];
  columns: Column<T>[];
  onRowClick?: (row: T) => void;
  emptyState?: React.ReactNode;
  className?: string;
}) {
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col || !col.sortValue) return rows;
    const mul = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return -1 * mul;
      if (av > bv) return 1 * mul;
      return 0;
    });
  }, [rows, sort, columns]);

  function toggleSort(key: string) {
    setSort((s) => {
      if (!s || s.key !== key) return { key, dir: "asc" };
      if (s.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  }

  if (rows.length === 0) {
    return <>{emptyState}</>;
  }

  return (
    <div className={cn("panel overflow-hidden", className)}>
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-[hsl(var(--surface-sunken))]/60 text-[10.5px] font-medium uppercase tracking-[0.14em] text-tertiary">
          <tr>
            {columns.map((col) => {
              const isSorted = sort?.key === col.key;
              const cls = cn(
                "px-4 py-3 font-medium",
                col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left",
                col.hideOn === "sm" && "hidden sm:table-cell",
                col.hideOn === "md" && "hidden md:table-cell",
              );
              return (
                <th key={col.key} className={cls} style={{ width: col.width }}>
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                    >
                      {col.header}
                      {isSorted ? (
                        sort.dir === "asc" ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-40" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sorted.map((row) => (
            <tr
              key={row.id}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                "transition-colors",
                onRowClick && "cursor-pointer hover:bg-secondary/40",
              )}
            >
              {columns.map((col) => {
                const cls = cn(
                  "px-4 py-3.5",
                  col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left",
                  col.hideOn === "sm" && "hidden sm:table-cell",
                  col.hideOn === "md" && "hidden md:table-cell",
                );
                return (
                  <td key={col.key} className={cls}>
                    {col.cell(row)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
