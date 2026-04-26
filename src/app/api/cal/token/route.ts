import { NextResponse } from "next/server";
import { can, getActiveVenue } from "@/lib/tenant";
import {
  getOrCreateCalendarToken,
  rotateCalendarToken,
} from "@/server/calendar";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "manage_venue")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const token = await getOrCreateCalendarToken(ctx.venueId);
  return NextResponse.json({ token });
}

export async function POST() {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "manage_venue")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const token = await rotateCalendarToken(ctx.venueId);
  return NextResponse.json({ token });
}
