import { NextResponse } from "next/server";
import { getActiveVenue, can } from "@/lib/tenant";
import { deleteVenue, updateVenue } from "@/server/venues";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "manage_venue")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const updated = await updateVenue({ orgId: ctx.orgId, venueId: params.id, raw: body });
    return NextResponse.json(updated);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "invalid";
    return NextResponse.json({ error: msg }, { status: msg === "not_found" ? 404 : 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "manage_venue")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    await deleteVenue({ orgId: ctx.orgId, venueId: params.id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "invalid";
    const status = msg === "not_found" ? 404 : msg === "last_venue" ? 409 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
