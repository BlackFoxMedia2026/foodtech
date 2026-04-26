import { NextResponse } from "next/server";
import { getActiveVenue } from "@/lib/tenant";
import { markRead } from "@/server/notifications";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getActiveVenue();
  try {
    const updated = await markRead(ctx.venueId, params.id);
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
}
