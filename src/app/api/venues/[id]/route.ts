import { NextResponse } from "next/server";
import { getActiveVenue, can } from "@/lib/tenant";
import { deleteVenue, updateVenue } from "@/server/venues";

function actor(req: Request, ctx: Awaited<ReturnType<typeof getActiveVenue>>) {
  return {
    actorId: ctx.userId,
    actorEmail:
      (ctx.session?.user as { email?: string | null } | undefined)?.email ?? null,
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: req.headers.get("user-agent") ?? null,
  };
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "manage_venue")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const updated = await updateVenue({
      orgId: ctx.orgId,
      venueId: params.id,
      raw: body,
      actor: actor(req, ctx),
    });
    return NextResponse.json(updated);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "invalid";
    return NextResponse.json({ error: msg }, { status: msg === "not_found" ? 404 : 400 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "manage_venue")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    await deleteVenue({
      orgId: ctx.orgId,
      venueId: params.id,
      actor: actor(req, ctx),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "invalid";
    const status = msg === "not_found" ? 404 : msg === "last_venue" ? 409 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
