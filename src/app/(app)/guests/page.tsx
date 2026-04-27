import Link from "next/link";
import { Sparkles } from "lucide-react";
import { getActiveVenue } from "@/lib/tenant";
import { GuestsTable } from "@/components/guests/guests-table";
import { ExportButton } from "@/components/ui/export-button";
import { SegmentsBar } from "@/components/guests/segments-bar";
import {
  countSegments,
  listGuestsForSegment,
  SEGMENT_DEFS,
  type SegmentKey,
} from "@/server/segments";

export const dynamic = "force-dynamic";

function pickSegment(s: string | undefined): SegmentKey {
  const valid = SEGMENT_DEFS.map((d) => d.key);
  return (valid as string[]).includes(s ?? "") ? (s as SegmentKey) : "all";
}

export default async function GuestsPage({
  searchParams,
}: {
  searchParams: { q?: string; segment?: string };
}) {
  const ctx = await getActiveVenue();
  const segment = pickSegment(searchParams.segment);
  const [guests, counts] = await Promise.all([
    listGuestsForSegment(ctx.venueId, segment, searchParams.q),
    countSegments(ctx.venueId),
  ]);

  const activeDef = SEGMENT_DEFS.find((d) => d.key === segment)!;

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">CRM</p>
          <h1 className="text-display text-3xl">Ospiti</h1>
          <p className="text-sm text-muted-foreground">
            {guests.length} risultati · segmento &quot;{activeDef.label}&quot;
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/guests/insights"
            className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary"
          >
            <Sparkles className="h-3.5 w-3.5 text-gilt-dark" /> Smart insights
          </Link>
          <ExportButton kind="guests" />
        </div>
      </header>

      <SegmentsBar active={segment} counts={counts} query={searchParams.q} />

      <GuestsTable rows={guests} />
    </div>
  );
}
