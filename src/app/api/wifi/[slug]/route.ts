import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { submitWifiLead } from "@/server/wifi";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;
  const userAgent = req.headers.get("user-agent");
  try {
    const result = await submitWifiLead({
      venueSlug: params.slug,
      payload: body,
      ipAddress,
      userAgent,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "invalid_input", issues: err.issues }, { status: 400 });
    }
    const code = err instanceof Error ? err.message : "unknown";
    const status =
      code === "venue_not_found"
        ? 404
        : code === "contact_required" || code === "privacy_required"
          ? 400
          : 500;
    return NextResponse.json({ error: code }, { status });
  }
}
