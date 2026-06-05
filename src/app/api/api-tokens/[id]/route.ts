import { NextResponse } from "next/server";
import { can, getActiveVenue } from "@/lib/tenant";
import { revokeApiToken } from "@/server/api-tokens";

export const dynamic = "force-dynamic";

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "manage_venue")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    await revokeApiToken(ctx.venueId, params.id, {
      actorId: ctx.userId,
      actorEmail: (ctx.session?.user as { email?: string | null } | undefined)?.email ?? null,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: req.headers.get("user-agent") ?? null,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
}
