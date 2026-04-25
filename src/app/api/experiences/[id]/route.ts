import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getActiveVenue } from "@/lib/tenant";
import { deleteExperience, updateExperience } from "@/server/experiences";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getActiveVenue();
  try {
    const body = await req.json();
    const updated = await updateExperience(ctx.venueId, params.id, body);
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "invalid_input", issues: err.issues }, { status: 400 });
    }
    const code = err instanceof Error ? err.message : "invalid";
    return NextResponse.json({ error: code }, { status: code === "not_found" ? 404 : 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getActiveVenue();
  try {
    await deleteExperience(ctx.venueId, params.id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
}
