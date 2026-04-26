import { db } from "@/lib/db";

export type TableLite = {
  id: string;
  label: string;
  seats: number;
  posX: number;
  posY: number;
  combinable: boolean;
  active: boolean;
  width: number | null;
  height: number | null;
};

export type AssignmentSuggestion = {
  kind: "single" | "combination";
  tableIds: string[];
  totalSeats: number;
  // distance is "wasted seats" (smaller = better fit)
  waste: number;
  labels: string[];
};

const ADJACENCY_MAX_PX = 220;

function distance(a: TableLite, b: TableLite) {
  const dx = a.posX - b.posX;
  const dy = a.posY - b.posY;
  return Math.sqrt(dx * dx + dy * dy);
}

function adjacent(a: TableLite, b: TableLite) {
  return distance(a, b) <= ADJACENCY_MAX_PX;
}

export async function getOccupiedTableIds(opts: {
  venueId: string;
  startsAt: Date;
  durationMin: number;
  ignoreBookingId?: string;
}) {
  const slotEnd = new Date(opts.startsAt.getTime() + opts.durationMin * 60_000);
  const dayStart = new Date(opts.startsAt);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(opts.startsAt);
  dayEnd.setHours(23, 59, 59, 999);
  const [bookings, blocks] = await Promise.all([
    db.booking.findMany({
      where: {
        venueId: opts.venueId,
        startsAt: { gte: dayStart, lte: dayEnd },
        status: { in: ["CONFIRMED", "PENDING", "ARRIVED", "SEATED"] },
        ...(opts.ignoreBookingId ? { NOT: { id: opts.ignoreBookingId } } : {}),
      },
      select: { startsAt: true, durationMin: true, tableId: true },
    }),
    db.tableBlock.findMany({
      where: {
        venueId: opts.venueId,
        startsAt: { lte: dayEnd },
        endsAt: { gte: dayStart },
      },
      select: { startsAt: true, endsAt: true, tableId: true },
    }),
  ]);

  const occupied = new Set<string>();
  for (const b of bookings) {
    if (!b.tableId) continue;
    const bEnd = new Date(b.startsAt.getTime() + b.durationMin * 60_000);
    if (b.startsAt < slotEnd && bEnd > opts.startsAt) {
      occupied.add(b.tableId);
    }
  }
  for (const bl of blocks) {
    if (bl.startsAt < slotEnd && bl.endsAt > opts.startsAt) {
      occupied.add(bl.tableId);
    }
  }
  return occupied;
}

export async function suggestAssignment(opts: {
  venueId: string;
  partySize: number;
  startsAt: Date;
  durationMin?: number;
  ignoreBookingId?: string;
  maxResults?: number;
}): Promise<AssignmentSuggestion[]> {
  const duration = opts.durationMin ?? 105;
  const tables = await db.table.findMany({
    where: { venueId: opts.venueId, active: true },
    select: {
      id: true,
      label: true,
      seats: true,
      posX: true,
      posY: true,
      combinable: true,
      active: true,
      width: true,
      height: true,
    },
  });

  const occupied = await getOccupiedTableIds({
    venueId: opts.venueId,
    startsAt: opts.startsAt,
    durationMin: duration,
    ignoreBookingId: opts.ignoreBookingId,
  });

  const free = tables.filter((t) => !occupied.has(t.id));

  const suggestions: AssignmentSuggestion[] = [];

  // 1) Single tables that fit, prefer minimum waste
  for (const t of free) {
    if (t.seats >= opts.partySize) {
      suggestions.push({
        kind: "single",
        tableIds: [t.id],
        labels: [t.label],
        totalSeats: t.seats,
        waste: t.seats - opts.partySize,
      });
    }
  }

  // 2) Pairs of combinable adjacent tables
  if (suggestions.length === 0 || suggestions[0].waste > 0) {
    const combinables = free.filter((t) => t.combinable);
    for (let i = 0; i < combinables.length; i++) {
      for (let j = i + 1; j < combinables.length; j++) {
        const a = combinables[i];
        const b = combinables[j];
        if (!adjacent(a, b)) continue;
        const total = a.seats + b.seats;
        if (total < opts.partySize) continue;
        suggestions.push({
          kind: "combination",
          tableIds: [a.id, b.id],
          labels: [a.label, b.label],
          totalSeats: total,
          waste: total - opts.partySize,
        });
      }
    }
  }

  suggestions.sort((s1, s2) => {
    if (s1.kind !== s2.kind) return s1.kind === "single" ? -1 : 1;
    return s1.waste - s2.waste;
  });

  return suggestions.slice(0, opts.maxResults ?? 5);
}
