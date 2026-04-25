import { NextResponse } from "next/server";
import { getActiveVenue } from "@/lib/tenant";
import { notifyTableReady } from "@/server/waitlist";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getActiveVenue();
  try {
    const updated = await notifyTableReady(ctx.venueId, params.id);
    return NextResponse.json(updated);
  } catch (err) {
    const code = err instanceof Error ? err.message : "invalid";
    return NextResponse.json({ error: code }, { status: code === "not_found" ? 404 : 500 });
  }
}
