import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { can, getActiveVenue } from "@/lib/tenant";
import { createTemplate, listTemplates } from "@/server/templates";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getActiveVenue();
  const items = await listTemplates(ctx.venueId);
  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "edit_marketing")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    const body = await req.json();
    const created = await createTemplate(ctx.venueId, body);
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "invalid_input", issues: err.issues }, { status: 400 });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "invalid" }, { status: 400 });
  }
}
