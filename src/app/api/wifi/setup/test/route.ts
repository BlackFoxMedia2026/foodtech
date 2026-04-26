import { NextResponse } from "next/server";
import { can, getActiveVenue } from "@/lib/tenant";
import { simulateWifiLead } from "@/server/wifi-setup";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "edit_marketing")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    const result = await simulateWifiLead({
      venueId: ctx.venueId,
      venueSlug: ctx.venue.slug,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "test_failed" },
      { status: 500 },
    );
  }
}
