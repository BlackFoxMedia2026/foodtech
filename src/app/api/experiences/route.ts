import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getActiveVenue } from "@/lib/tenant";
import { createExperience } from "@/server/experiences";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ctx = await getActiveVenue();
  try {
    const body = await req.json();
    const created = await createExperience(ctx.venueId, body);
    return NextResponse.json(created, { status: 201 });
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
