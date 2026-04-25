import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { recordResponse } from "@/server/surveys";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { token: string } }) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  try {
    const result = await recordResponse(params.token, body);
    return NextResponse.json({ ok: true, sentiment: result.sentiment });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "invalid_input", issues: err.issues }, { status: 400 });
    }
    const code = err instanceof Error ? err.message : "unknown";
    const status =
      code === "not_found" ? 404 : code === "already_submitted" ? 409 : 500;
    return NextResponse.json({ error: code }, { status });
  }
}
