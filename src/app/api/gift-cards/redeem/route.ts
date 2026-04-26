import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { can, getActiveVenue } from "@/lib/tenant";
import { redeemGiftCard } from "@/server/gift-cards";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "manage_bookings")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const result = await redeemGiftCard(ctx.venueId, body, ctx.userId);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "invalid_input", issues: err.issues }, { status: 400 });
    }
    const code = err instanceof Error ? err.message : "invalid";
    const status =
      code === "wrong_venue"
        ? 403
        : code === "not_active" || code === "expired" || code === "insufficient_balance"
          ? 409
          : 400;
    return NextResponse.json({ error: code }, { status });
  }
}
