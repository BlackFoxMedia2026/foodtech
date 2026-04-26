import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createTableOrder } from "@/server/table-orders";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: { slug: string; tableLabel: string } },
) {
  const limited = rateLimit(req, {
    key: `table-order:${params.slug}:${params.tableLabel}`,
    max: 10,
    windowMs: 60_000,
  });
  if (!limited.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  try {
    const order = await createTableOrder(params.slug, params.tableLabel, body);
    return NextResponse.json(
      { reference: order.reference, totalCents: order.totalCents },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "invalid_input", issues: err.issues }, { status: 400 });
    }
    const code = err instanceof Error ? err.message : "unknown";
    const status =
      code === "venue_not_found" || code === "table_not_found"
        ? 404
        : code === "empty_items"
          ? 400
          : 500;
    return NextResponse.json({ error: code }, { status });
  }
}
