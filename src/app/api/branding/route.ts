import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { can, getActiveVenue } from "@/lib/tenant";
import { getVenueBrandById, saveVenueBrand } from "@/server/branding";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "manage_venue")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const brand = await getVenueBrandById(ctx.venueId);
  return NextResponse.json(brand);
}

export async function PATCH(req: Request) {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "manage_venue")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const updated = await saveVenueBrand(ctx.venueId, body);
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "invalid_input", issues: err.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "invalid" },
      { status: 400 },
    );
  }
}
