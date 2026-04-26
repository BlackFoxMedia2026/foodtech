import { NextResponse } from "next/server";
import { can, getActiveVenue } from "@/lib/tenant";
import { deleteCost } from "@/server/finance";

export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "view_revenue")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    await deleteCost(ctx.venueId, params.id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
}
