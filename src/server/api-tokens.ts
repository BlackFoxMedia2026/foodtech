import { z } from "zod";
import crypto from "node:crypto";
import { db } from "@/lib/db";

// External API tokens. We split each token into two parts:
//   - prefix:  short, unique, stored in cleartext (e.g. "tav_AB12CD34")
//   - secret:  random 32 chars, never persisted; we keep only sha256(secret)
// The full token shown to the operator is `prefix.secret` (joined by '.').
// Lookup: parse the prefix, find the row, timing-safe compare the hash.

export const SCOPES = [
  "bookings:read",
  "bookings:write",
  "orders:read",
  "guests:read",
  "menu:read",
  "messages:read",
  "reviews:read",
] as const;
export type ApiScope = (typeof SCOPES)[number];

export const ApiTokenInput = z.object({
  name: z.string().min(2).max(120),
  scopes: z.array(z.enum(SCOPES)).min(1).max(SCOPES.length),
  expiresInDays: z.coerce.number().int().min(1).max(3650).optional(),
});

export type CreatedToken = {
  id: string;
  prefix: string;
  scopes: string[];
  expiresAt: Date | null;
  // The plaintext token, returned only once on creation.
  token: string;
};

const PREFIX_PREFIX = "tav_";

function randomAlphanum(length: number) {
  const bytes = crypto.randomBytes(length);
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

function hashSecret(secret: string) {
  return crypto.createHash("sha256").update(secret).digest("hex");
}

export async function createApiToken(
  venueId: string,
  raw: unknown,
  createdBy: string | null,
): Promise<CreatedToken> {
  const data = ApiTokenInput.parse(raw);
  const prefix = `${PREFIX_PREFIX}${randomAlphanum(8)}`;
  const secret = randomAlphanum(32);
  const hashed = hashSecret(secret);
  const expiresAt = data.expiresInDays
    ? new Date(Date.now() + data.expiresInDays * 86400_000)
    : null;
  const created = await db.apiToken.create({
    data: {
      venueId,
      name: data.name,
      prefix,
      hashedSecret: hashed,
      scopes: data.scopes,
      expiresAt,
      createdBy,
    },
  });
  return {
    id: created.id,
    prefix: created.prefix,
    scopes: created.scopes,
    expiresAt: created.expiresAt,
    token: `${prefix}.${secret}`,
  };
}

export async function listApiTokens(venueId: string) {
  return db.apiToken.findMany({
    where: { venueId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      prefix: true,
      scopes: true,
      lastUsedAt: true,
      expiresAt: true,
      revokedAt: true,
      createdAt: true,
    },
  });
}

export async function revokeApiToken(venueId: string, id: string) {
  const existing = await db.apiToken.findFirst({ where: { id, venueId } });
  if (!existing) throw new Error("not_found");
  if (existing.revokedAt) return existing;
  return db.apiToken.update({
    where: { id },
    data: { revokedAt: new Date() },
  });
}

export type AuthedToken = {
  id: string;
  venueId: string;
  scopes: string[];
};

// Parses the Authorization header and returns the matching token if valid.
// Throws on invalid auth so callers can short-circuit with the error code.
export async function verifyApiToken(req: Request): Promise<AuthedToken> {
  const header = req.headers.get("authorization") ?? "";
  const m = header.match(/^Bearer\s+(\S+)$/i);
  if (!m) throw new Error("missing_bearer");
  const token = m[1];
  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) throw new Error("invalid_format");
  const prefix = token.slice(0, dot);
  const secret = token.slice(dot + 1);
  if (!prefix.startsWith(PREFIX_PREFIX)) throw new Error("invalid_format");

  const row = await db.apiToken.findUnique({
    where: { prefix },
    select: {
      id: true,
      venueId: true,
      hashedSecret: true,
      scopes: true,
      revokedAt: true,
      expiresAt: true,
    },
  });
  if (!row) throw new Error("invalid_token");
  if (row.revokedAt) throw new Error("revoked");
  if (row.expiresAt && row.expiresAt < new Date()) throw new Error("expired");

  const expected = Buffer.from(row.hashedSecret, "hex");
  const incoming = Buffer.from(hashSecret(secret), "hex");
  if (
    expected.length !== incoming.length ||
    !crypto.timingSafeEqual(expected, incoming)
  ) {
    throw new Error("invalid_token");
  }

  // Best-effort lastUsedAt — fire-and-forget.
  void db.apiToken
    .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
    .catch(() => undefined);

  return { id: row.id, venueId: row.venueId, scopes: row.scopes };
}

export function requireScope(authed: AuthedToken, scope: ApiScope) {
  if (!authed.scopes.includes(scope)) {
    throw new Error("insufficient_scope");
  }
}
