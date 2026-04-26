import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getActiveVenue } from "@/lib/tenant";
import { listOrdersToday } from "@/server/orders";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getActiveVenue();
  const items = await listOrdersToday(ctx.venueId);
  return NextResponse.json(items);
}

// no POST here — admin can't create orders directly; use /api/orders/public/[slug]
export async function POST() {
  return NextResponse.json({ error: "method_not_allowed" }, { status: 405 });
}

void ZodError;
