import { NextResponse } from "next/server";
import { ingestExternalBooking } from "@/server/connectors";
import { rateLimit } from "@/lib/rate-limit";
import { captureError } from "@/lib/observability";
import type { ConnectorKind } from "@/lib/connectors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID: ConnectorKind[] = [
  "THEFORK",
  "GOOGLE_RESERVE",
  "BOOKING_COM",
  "OPENTABLE",
  "CUSTOM",
];

export async function POST(
  req: Request,
  { params }: { params: { venueId: string; kind: string } },
) {
  const limited = rateLimit(req, {
    key: `connector:${params.venueId}:${params.kind}`,
    max: 120,
    windowMs: 60_000,
  });
  if (!limited.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const kind = params.kind.toUpperCase() as ConnectorKind;
  if (!VALID.includes(kind)) {
    return NextResponse.json({ error: "invalid_kind" }, { status: 400 });
  }

  // Read the raw body once so we can both verify the signature and parse it.
  const rawBody = await req.text();
  let parsedBody: unknown = null;
  try {
    parsedBody = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const signature = req.headers.get("x-tavolo-signature");
  try {
    const result = await ingestExternalBooking({
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
            : code === "invalid_payload" || code === "invalid_datetime"
              ? 400
              : 500;
    if (status >= 500) {
      captureError(err, {
        module: "connector-webhook",
        venueId: params.venueId,
        extra: { kind: params.kind },
      });
    }
    return NextResponse.json({ error: code }, { status });
  }
}
