import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { startChatSession } from "@/server/chat";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await startChatSession(params.slug, body);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "invalid_input", issues: err.issues }, { status: 400 });
    }
    const code = err instanceof Error ? err.message : "unknown";
    return NextResponse.json(
      { error: code },
      { status: code === "venue_not_found" ? 404 : 400 },
    );
  }
}
