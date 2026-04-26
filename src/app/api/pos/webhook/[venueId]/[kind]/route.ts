import { NextResponse } from "next/server";
import { ingestInboundSale } from "@/server/pos";
import { rateLimit } from "@/lib/rate-limit";
import { captureError } from "@/lib/observability";
import type { POSKind } from "@/lib/pos";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID: POSKind[] = ["SQUARE", "LIGHTSPEED", "SUMUP", "IZETTLE", "TOAST", "CUSTOM"];

export async function POST(
  req: Request,
  { params }: { params: { venueId: string; kind: string } },
) {
  const limited = rateLimit(req, {
    key: `pos:${params.venueId}:${params.kind}`,
    max: 240,
    windowMs: 60_000,
  });
  if (!limited.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const kind = params.kind.toUpperCase() as POSKind;
  if (!VALID.includes(kind)) {
    return NextResponse.json({ error: "invalid_kind" }, { status: 400 });
  }

  const rawBody = await req.text();
  let parsedBody: unknown = null;
  try {
    parsedBody = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const signature = req.headers.get("x-tavolo-signature");
  try {
    const result = await ingestInboundSale({
      venueId: params.venueId,
      kind,
      rawBody,
      parsedBody,
      signature,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const code = err instanceof Error ? err.message : "unknown";
    const status =
      code === "connector_not_found"
        ? 404
        : code === "connector_paused"
          ? 423
          : code === "invalid_signature"
            ? 401
            : code === "invalid_payload"
              ? 400
              : 500;
    if (status >= 500) {
      captureError(err, {
        module: "pos-webhook",
        venueId: params.venueId,
        extra: { kind: params.kind },
      });
    }
    return NextResponse.json({ error: code }, { status });
  }
}
