import { NextResponse } from "next/server";
import { can, getActiveVenue } from "@/lib/tenant";
import { syncGoogleReviews } from "@/server/reviews";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "edit_marketing")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const result = await syncGoogleReviews(ctx.venueId);
  return NextResponse.json(result);
}
