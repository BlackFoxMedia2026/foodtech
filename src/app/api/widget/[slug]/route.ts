import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createPublicBooking } from "@/server/widget";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { slug: string } },
) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  try {
    const { reference } = await createPublicBooking(params.slug, payload);
    return NextResponse.json({ reference });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "invalid_input", details: err.issues }, { status: 400 });
    }
    const code = err instanceof Error ? err.message : "unknown";
    const status =
      code === "venue_not_found"
        ? 404
        : code === "slot_unavailable" || code === "outside_service" || code === "invalid_datetime"
          ? 409
          : 500;
    return NextResponse.json({ error: code }, { status });
  }
}
