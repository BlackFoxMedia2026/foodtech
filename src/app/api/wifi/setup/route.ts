import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { can, getActiveVenue } from "@/lib/tenant";
import { getWifiSetup, saveWifiSetup } from "@/server/wifi-setup";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "edit_marketing")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const setup = await getWifiSetup(ctx.venueId);
  return NextResponse.json(setup);
}

export async function PATCH(req: Request) {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "edit_marketing")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    const body = await req.json();
    await saveWifiSetup(ctx.venueId, body);
    const updated = await getWifiSetup(ctx.venueId);
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "invalid_input", issues: err.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "invalid" },
      { status: 400 },
    );
  }
}
