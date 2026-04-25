import { NextResponse } from "next/server";
import { can, getActiveVenue } from "@/lib/tenant";
import { sendCampaign } from "@/server/campaigns";
import { isEmailEnabled } from "@/lib/email";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "edit_marketing")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    const result = await sendCampaign(
      ctx.venueId,
      params.id,
      process.env.RESEND_FROM ?? "Tavolo <noreply@tavolo.local>",
    );
    return NextResponse.json({ ...result, emailEnabled: isEmailEnabled() });
  } catch (err) {
    const code = err instanceof Error ? err.message : "unknown";
    const status = code === "not_found" ? 404 : code === "already_sent" ? 409 : code === "channel_unsupported" ? 400 : 500;
    return NextResponse.json({ error: code }, { status });
  }
}
