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

// POST /api/auth/2fa/recovery-codes/regenerate { totpCode }
// Richiede TOTP corrente, invalida i recovery code esistenti e restituisce 10
// nuovi codici in chiaro (UNA volta). Rate-limit più stretto (3/5min): è
// un'operazione rara.
export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(req, {
    key: `2fa-recovery-regen:${userId}`,
    max: 3,
    windowMs: 5 * 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "too_many_attempts", resetAt: rl.resetAt },
      { status: 429 },
    );
  }

  let totpCode: string | undefined;
  try {
    const body = (await req.json()) as { totpCode?: unknown };
    totpCode = typeof body.totpCode === "string" ? body.totpCode : undefined;
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  if (!totpCode) {
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
  if (!user?.totpEnabled || !user.totpSecret) {
    return NextResponse.json({ error: "not_enabled" }, { status: 400 });
  }
  if (!verifyTotp(user.totpSecret, totpCode)) {
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }

  const plaintextRecoveryCodes = generateRecoveryCodes(10);
  const hashed = plaintextRecoveryCodes.map(hashRecoveryCode);
  await db.user.update({
    where: { id: userId },
    data: { recoveryCodesHash: hashed },
  });

  const orgId = user.orgMemberships[0]?.orgId;
  if (orgId) {
    await logAudit({
      orgId,
      actorId: userId,
      actorEmail: user.email,
      action: "user.2fa.recovery_codes.regenerate",
      entityType: "User",
      entityId: userId,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: req.headers.get("user-agent") ?? null,
    });
  }

  return NextResponse.json({ ok: true, recoveryCodes: plaintextRecoveryCodes });
}
