import { NextResponse } from "next/server";
import { getActiveVenue } from "@/lib/tenant";
import { markAllRead } from "@/server/notifications";

export const dynamic = "force-dynamic";

export async function POST() {
  const ctx = await getActiveVenue();
  const result = await markAllRead(ctx.venueId);
  return NextResponse.json(result);
}
