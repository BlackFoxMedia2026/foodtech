import { NextResponse } from "next/server";
import { getActiveVenue, can } from "@/lib/tenant";
import { createVenue } from "@/server/venues";

export async function POST(req: Request) {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "manage_venue")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const created = await createVenue({ orgId: ctx.orgId, userId: ctx.userId, raw: body });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "invalid" },
      { status: 400 },
    );
  }
}
