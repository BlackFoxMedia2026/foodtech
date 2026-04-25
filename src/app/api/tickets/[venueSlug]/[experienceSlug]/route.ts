import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createTicket } from "@/server/tickets";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { venueSlug: string; experienceSlug: string } },
) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  try {
    const result = await createTicket({
      venueSlug: params.venueSlug,
      experienceSlug: params.experienceSlug,
      payload: body,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "invalid_input", issues: err.issues }, { status: 400 });
    }
    const code = err instanceof Error ? err.message : "unknown";
    const status =
      code === "not_found" ? 404 : code === "sold_out" || code === "event_past" ? 409 : 500;
    return NextResponse.json({ error: code }, { status });
  }
}
