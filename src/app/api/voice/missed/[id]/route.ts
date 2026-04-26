import { NextResponse } from "next/server";
import { can, getActiveVenue } from "@/lib/tenant";
import { scheduleMissedCallback } from "@/server/voice";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "manage_bookings")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    await scheduleMissedCallback(ctx.venueId, params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const code = err instanceof Error ? err.message : "unknown";
    return NextResponse.json({ error: code }, { status: code === "not_found" ? 404 : 400 });
  }
}
