import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  getPreorderForReference,
  savePreorderForReference,
} from "@/server/preorders";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { ref: string } }) {
  const preorder = await getPreorderForReference(params.ref);
  if (!preorder) return NextResponse.json(null);
  return NextResponse.json(preorder);
}

export async function PUT(req: Request, { params }: { params: { ref: string } }) {
  const limited = rateLimit(req, {
    key: `preorder:${params.ref}`,
    max: 10,
    windowMs: 60_000,
  });
  if (!limited.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  try {
    const body = await req.json();
    const updated = await savePreorderForReference(params.ref, body);
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "invalid_input", issues: err.issues }, { status: 400 });
    }
    const code = err instanceof Error ? err.message : "invalid";
    const status =
      code === "not_found"
        ? 404
        : code === "locked" || code === "too_late"
          ? 409
          : 400;
    return NextResponse.json({ error: code }, { status });
  }
}
