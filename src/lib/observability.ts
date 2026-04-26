// Lightweight error reporter. By default we log structured JSON to stderr,
// which Vercel ingests automatically. When `SENTRY_DSN` is set we POST a
// minimal envelope to Sentry's HTTP API (so we don't pull a 200kB SDK into
// every server bundle). Either way, calls are fire-and-forget and never
// block the request path.

type Severity = "error" | "warning" | "info";

export type ErrorContext = {
  module?: string;            // e.g. "chat", "voice-webhook", "automations"
  venueId?: string;
  resourceId?: string;        // bookingId / chatSessionId / workflowId etc.
  extra?: Record<string, unknown>;
};

export function captureError(
  err: unknown,
  ctx: ErrorContext = {},
  severity: Severity = "error",
) {
  const payload = {
    level: severity,
    module: ctx.module ?? "unknown",
    venueId: ctx.venueId,
    resourceId: ctx.resourceId,
    extra: ctx.extra,
    error: serializeError(err),
    timestamp: new Date().toISOString(),
  };
  // Always log: cheap, indexed by the platform.
  // eslint-disable-next-line no-console
  console.error(`[tavolo:${severity}]`, JSON.stringify(payload));

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  // Best-effort: don't throw and don't await.
  void postToSentry(dsn, payload).catch((e) => {
    // eslint-disable-next-line no-console
    console.error("[tavolo:observability] sentry post failed", e);
  });
}

export function captureWarning(message: string, ctx: ErrorContext = {}) {
  captureError(new Error(message), ctx, "warning");
}

function serializeError(err: unknown) {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
    };
  }
  return { message: String(err) };
}

async function postToSentry(dsn: string, payload: unknown) {
  // Minimal Sentry envelope sender. Parses the DSN as documented:
  // https://docs.sentry.io/concepts/key-terms/dsn-explainer/
  const parsed = parseDsn(dsn);
  if (!parsed) return;
  const { host, projectId, publicKey } = parsed;
  const auth = [
    "Sentry sentry_version=7",
    "sentry_client=tavolo-observability/1.0",
    `sentry_key=${publicKey}`,
  ].join(", ");
  const eventId = randomHex(32);
  const envelope =
    JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString() }) +
    "\n" +
    JSON.stringify({ type: "event" }) +
    "\n" +
    JSON.stringify({
      event_id: eventId,
      level: "error",
      platform: "node",
      message: { formatted: JSON.stringify(payload) },
    });

  await fetch(`https://${host}/api/${projectId}/envelope/`, {
    method: "POST",
    headers: {
      "x-sentry-auth": auth,
      "content-type": "application/x-sentry-envelope",
    },
    body: envelope,
  });
}

function parseDsn(dsn: string): { host: string; projectId: string; publicKey: string } | null {
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace(/^\/+/, "");
    if (!projectId) return null;
    return {
      host: url.host,
      projectId,
      publicKey: url.username,
    };
  } catch {
    return null;
  }
}

function randomHex(len: number) {
  const chars = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export function isObservabilityEnabled() {
  return Boolean(process.env.SENTRY_DSN);
}
