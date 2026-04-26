import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { postChatTurn } from "@/server/chat";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const result = await postChatTurn(params.id, body);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "invalid_input", issues: err.issues }, { status: 400 });
    }
    const code = err instanceof Error ? err.message : "unknown";
    return NextResponse.json(
      { error: code },
      { status: code === "not_found" ? 404 : code === "closed" ? 409 : 400 },
    );
  }
}
