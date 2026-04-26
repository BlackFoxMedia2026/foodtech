import { NextResponse } from "next/server";
import { can, getActiveVenue } from "@/lib/tenant";
import { approveVoiceDraft, rejectVoiceDraft } from "@/server/voice";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "manage_bookings")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const action = new URL(req.url).searchParams.get("action") ?? "approve";
  try {
    if (action === "approve") {
      const booking = await approveVoiceDraft(ctx.venueId, params.id, ctx.userId);
      return NextResponse.json({ ok: true, bookingId: booking.id });
    }
    if (action === "reject") {
      await rejectVoiceDraft(ctx.venueId, params.id, ctx.userId);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  } catch (err) {
    const code = err instanceof Error ? err.message : "unknown";
    return NextResponse.json({ error: code }, { status: code === "not_found" ? 404 : 400 });
  }
}
