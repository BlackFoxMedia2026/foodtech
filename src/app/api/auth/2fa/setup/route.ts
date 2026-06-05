import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildOtpAuthUrl, generateTotpSecret } from "@/lib/totp";

export const dynamic = "force-dynamic";

// POST /api/auth/2fa/setup
// Genera un nuovo secret TOTP per l'utente loggato e lo salva NON-confermato.
// L'utente deve poi confermare il setup via /api/auth/2fa/verify con un codice
// valido — solo allora `totpEnabled = true`. Chiamate ripetute rigenerano il
// secret (utile se il QR è andato perso prima della verifica).
export async function POST() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, totpEnabled: true },
  });
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (user.totpEnabled) {
    return NextResponse.json({ error: "already_enabled" }, { status: 400 });
  }

  const secret = generateTotpSecret();
  await db.user.update({
    where: { id: userId },
    data: { totpSecret: secret, totpEnabled: false },
  });

  const otpauth_url = buildOtpAuthUrl(secret, user.email, "Tavolo");
  // QR rendering delegato a servizio esterno per evitare dipendenze npm
  // dedicate al QR. Il client può anche mostrare l'otpauth_url come testo
  // copiabile o codice manuale (`secret`) se preferisce.
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(otpauth_url)}`;
  return NextResponse.json({ secret, otpauth_url, qrCodeUrl });
}
