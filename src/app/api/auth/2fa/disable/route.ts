import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { verifyTotp } from "@/lib/totp";

export const dynamic = "force-dynamic";

// POST /api/auth/2fa/disable { code }
// Richiede il codice TOTP corrente per disabilitare il 2FA (prevenzione
// session-hijack che disabilita 2FA senza conoscere il device).
export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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
    select: { totpSecret: true, totpEnabled: true },
  });
  if (!user?.totpEnabled || !user.totpSecret) {
    return NextResponse.json({ error: "not_enabled" }, { status: 400 });
  }
  if (!verifyTotp(user.totpSecret, code)) {
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }

  await db.user.update({
    where: { id: userId },
    data: { totpSecret: null, totpEnabled: false },
  });
  return NextResponse.json({ ok: true });
}
