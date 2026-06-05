// TOTP (RFC 6238) zero-dipendenze: usa solo `node:crypto`.
// HMAC-SHA1, 30s window, 6 digit code. Drift ±N steps configurabile.
//
// Perché non `otplib`/`speakeasy`: l'algoritmo è semplice e auto-contenuto
// (≈80 righe). Evitiamo una dipendenza npm dichiarata e ne controlliamo la
// superficie di attacco. Nessuna parte è time-sensitive oltre `Date.now()`.

import crypto from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i]!;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += BASE32_ALPHABET[(value >>> bits) & 0x1f];
    }
  }
  if (bits > 0) {
    out += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }
  // No padding: gli authenticator (Google/Authy/1Password) accettano base32
  // senza `=` di padding. Mantenere stretto per QR più compatto.
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/g, "").toUpperCase().replace(/\s+/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error("invalid_base32_char");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >>> bits) & 0xff);
    }
  }
  return Buffer.from(out);
}

export function generateTotpSecret(): string {
  // 20 random bytes = 160-bit secret, conforme RFC 4226 §4 requisito minimo.
  return base32Encode(crypto.randomBytes(20));
}

function hotp(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  // counter big-endian 64-bit. JS bitwise è 32-bit: scriviamo high/low.
  let hi = Math.floor(counter / 0x100000000);
  let lo = counter >>> 0;
  for (let i = 7; i >= 0; i--) {
    if (i >= 4) {
      buf[i] = lo & 0xff;
      lo = Math.floor(lo / 256);
    } else {
      buf[i] = hi & 0xff;
      hi = Math.floor(hi / 256);
    }
  }
  const hmac = crypto.createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const code =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  return (code % 1_000_000).toString().padStart(6, "0");
}

const STEP_SECONDS = 30;

export function totpAt(secret: string, atSeconds: number): string {
  return hotp(secret, Math.floor(atSeconds / STEP_SECONDS));
}

export function verifyTotp(secret: string, code: string, drift = 1): boolean {
  const cleaned = code.replace(/\D/g, "");
  if (cleaned.length !== 6) return false;
  const now = Math.floor(Date.now() / 1000);
  for (let i = -drift; i <= drift; i++) {
    try {
      const candidate = totpAt(secret, now + i * STEP_SECONDS);
      // timing-safe compare per evitare side-channel (ridondante per 6 cifre
      // ma costa zero ed è una buona prassi).
      if (
        candidate.length === cleaned.length &&
        crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(cleaned))
      ) {
        return true;
      }
    } catch {
      return false;
    }
  }
  return false;
}

export function buildOtpAuthUrl(
  secret: string,
  accountName: string,
  issuer = "Tavolo",
): string {
  const label = encodeURIComponent(`${issuer}:${accountName}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: "6",
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
