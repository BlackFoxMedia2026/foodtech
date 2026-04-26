import { NextResponse } from "next/server";
import { can, getActiveVenue } from "@/lib/tenant";
import { revokeApiToken } from "@/server/api-tokens";

export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "manage_venue")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    await revokeApiToken(ctx.venueId, params.id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
}
