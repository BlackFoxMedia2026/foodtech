import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { recordMenuScan } from "@/server/menu-leadmagnet";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  try {
    const body = await req.json().catch(() => ({}));
    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const userAgent = req.headers.get("user-agent");
    const result = await recordMenuScan(params.slug, {
      ...body,
      ipAddress,
      userAgent,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "invalid_input", issues: err.issues }, { status: 400 });
    }
    const code = err instanceof Error ? err.message : "unknown";
    return NextResponse.json({ error: code }, { status: code === "venue_not_found" ? 404 : 400 });
  }
}
