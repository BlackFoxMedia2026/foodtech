import { NextResponse } from "next/server";
import { getPublicVenue, getAvailableSlots } from "@/server/widget";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { slug: string } },
) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  const partySize = Number(url.searchParams.get("partySize") ?? 2);
  if (!date) return NextResponse.json({ error: "missing_date" }, { status: 400 });

  const venue = await getPublicVenue(params.slug);
  if (!venue) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const slots = await getAvailableSlots(venue.id, date, partySize);
  return NextResponse.json({ slots });
}
