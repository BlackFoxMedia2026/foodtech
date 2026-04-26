import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { can, getActiveVenue } from "@/lib/tenant";
import { adjustPoints, loyaltyHistory } from "@/server/loyalty";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "manage_bookings")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const items = await loyaltyHistory(params.id, 50);
  return NextResponse.json(items);
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "edit_marketing")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const txn = await adjustPoints(ctx.venueId, { ...body, guestId: params.id }, ctx.userId);
    return NextResponse.json(txn);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "invalid_input", issues: err.issues }, { status: 400 });
    }
    const code = err instanceof Error ? err.message : "invalid";
    return NextResponse.json(
      { error: code },
      { status: code === "not_found" ? 404 : code === "negative_balance" ? 409 : 400 },
    );
  }
}
