import { NextResponse } from "next/server";
import { can, getActiveVenue } from "@/lib/tenant";
import { previewSegment, SegmentInput } from "@/server/campaigns";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "edit_marketing")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const segment = SegmentInput.partial().parse(body ?? {});
  const result = await previewSegment(ctx.venueId, segment as Parameters<typeof previewSegment>[1]);
  return NextResponse.json({ total: result.total });
}
