import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { verifyTotp } from "@/lib/totp";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/server/audit";
import { sendUserSecurityEmail } from "@/server/security-email";

export const dynamic = "force-dynamic";

// POST /api/auth/2fa/disable { code }
// Richiede il codice TOTP corrente per disabilitare il 2FA (prevenzione
// session-hijack che disabilita 2FA senza conoscere il device).
//
// Rate-limit 5/5min per userId per fermare brute-force locale del codice.
export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(req, {
    key: `2fa-disable:${userId}`,
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
  if (!user?.totpEnabled || !user.totpSecret) {
    return NextResponse.json({ error: "not_enabled" }, { status: 400 });
  }
  if (!verifyTotp(user.totpSecret, code)) {
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }

  await db.user.update({
    where: { id: userId },
    // Disabilitando il 2FA azzeriamo anche i recovery codes: lasciarli vivi
    // sarebbe inconsistente (non c'è nulla da recuperare se non c'è 2FA).
    data: { totpSecret: null, totpEnabled: false, recoveryCodesHash: [] },
  });

  const orgId = user.orgMemberships[0]?.orgId;
  if (orgId) {
    await logAudit({
      orgId,
      actorId: userId,
      actorEmail: user.email,
      action: "user.2fa.disabled",
      entityType: "User",
      entityId: userId,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: req.headers.get("user-agent") ?? null,
    });
  }

  // Email out-of-band: la disattivazione del 2FA è un evento critico (un
  // attaccante che ha hijackato la sessione la userebbe per togliere il
  // secondo fattore). Fire-and-forget, catch interno.
  void sendUserSecurityEmail({
    userId,
    kind: "2fa.disabled",
    metadata: {
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: req.headers.get("user-agent") ?? null,
    },
  });

  return NextResponse.json({ ok: true });
}
