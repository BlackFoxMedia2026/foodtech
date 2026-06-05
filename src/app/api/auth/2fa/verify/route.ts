import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  generateRecoveryCodes,
  hashRecoveryCode,
  verifyTotp,
} from "@/lib/totp";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/server/audit";

export const dynamic = "force-dynamic";

// POST /api/auth/2fa/verify { code }
// Conferma il setup: se il codice è valido contro il secret pendente, marca
// `totpEnabled = true`. Da questo momento l'utente dovrà inserire un codice
// TOTP a ogni login.
//
// Inoltre, alla PRIMA conferma del setup, generiamo 10 recovery codes one-shot
// e li restituiamo in chiaro (solo qui). Salviamo solo lo sha256.
//
// Brute-force su /verify (10^6 spazio con drift ±1) è in linea di principio
// fattibile: applichiamo rate-limit 5/5min per userId.
export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(req, {
    key: `2fa-verify:${userId}`,
    max: 5,
    windowMs: 5 * 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "too_many_attempts", resetAt: rl.resetAt },
      { status: 429 },
    );
  }

  let code: string | undefined;
  try {
    const body = (await req.json()) as { code?: unknown };
    code = typeof body.code === "string" ? body.code : undefined;
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  if (!code) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      totpSecret: true,
      totpEnabled: true,
      orgMemberships: {
        select: { orgId: true },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });
  if (!user?.totpSecret) {
    return NextResponse.json({ error: "no_pending_secret" }, { status: 400 });
  }
  if (!verifyTotp(user.totpSecret, code)) {
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }

  const wasAlreadyEnabled = user.totpEnabled;
  // Generiamo recovery codes SOLO alla conferma iniziale; chiamate ripetute su
  // /verify (idempotenti) non li ri-emettono. Per ri-emetterli c'è l'endpoint
  // `/recovery-codes/regenerate`.
  let plaintextRecoveryCodes: string[] | undefined;
  if (!wasAlreadyEnabled) {
    plaintextRecoveryCodes = generateRecoveryCodes(10);
    const hashed = plaintextRecoveryCodes.map(hashRecoveryCode);
    await db.user.update({
      where: { id: userId },
      data: { totpEnabled: true, recoveryCodesHash: hashed },
    });
  } else {
    await db.user.update({
      where: { id: userId },
      data: { totpEnabled: true },
    });
  }

  const orgId = user.orgMemberships[0]?.orgId;
  if (orgId) {
    await logAudit({
      orgId,
      actorId: userId,
      actorEmail: user.email,
      action: "user.2fa.enabled",
      entityType: "User",
      entityId: userId,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: req.headers.get("user-agent") ?? null,
    });
  }

  return NextResponse.json({
    ok: true,
    ...(plaintextRecoveryCodes ? { recoveryCodes: plaintextRecoveryCodes } : {}),
  });
}
