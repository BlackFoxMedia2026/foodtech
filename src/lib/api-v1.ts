import { NextResponse } from "next/server";

export function tokenErrorResponse(err: unknown) {
  const code = err instanceof Error ? err.message : "unauthorized";
  const status =
    code === "missing_bearer" || code === "invalid_format"
      ? 401
      : code === "invalid_token" || code === "revoked" || code === "expired"
        ? 401
        : code === "insufficient_scope"
          ? 403
          : 401;
  return NextResponse.json({ error: code }, { status });
}
