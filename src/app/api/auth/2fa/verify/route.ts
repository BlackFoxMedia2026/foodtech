import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { verifyTotp } from "@/lib/totp";

export const dynamic = "force-dynamic";

// POST /api/auth/2fa/verify { code }
// Conferma il setup: se il codice è valido contro il secret pendente, marca
// `totpEnabled = true`. Da questo momento l'utente dovrà inserire un codice
// TOTP a ogni login.
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
  if (!user?.totpSecret) {
    return NextResponse.json({ error: "no_pending_secret" }, { status: 400 });
  }
  if (!verifyTotp(user.totpSecret, code)) {
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }

  await db.user.update({
    where: { id: userId },
    data: { totpEnabled: true },
  });
  return NextResponse.json({ ok: true });
}
