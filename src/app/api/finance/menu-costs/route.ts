import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { can, getActiveVenue } from "@/lib/tenant";
import { listMenuItemCosts, setMenuItemCost } from "@/server/finance";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "view_revenue")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const items = await listMenuItemCosts(ctx.venueId);
  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const ctx = await getActiveVenue();
  if (!can(ctx.role, "view_revenue")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const saved = await setMenuItemCost(ctx.venueId, body);
    return NextResponse.json(saved);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "invalid_input", issues: err.issues }, { status: 400 });
    }
    const code = err instanceof Error ? err.message : "invalid";
    return NextResponse.json({ error: code }, { status: code === "not_found" ? 404 : 400 });
  }
}
