import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { db } from "./db";
import {
  consumeRecoveryCode,
  looksLikeRecoveryCode,
  verifyTotp,
} from "./totp";
import { rateLimit } from "./rate-limit";
import { logAudit } from "@/server/audit";
import { pushNotification } from "@/server/notifications";
import { sendUserSecurityEmail } from "@/server/security-email";

// NextAuth's CredentialsProvider passa `req.headers` come Record<string,string>
// (NON come `Headers`). Il nostro `rateLimit()` accetta un `Request` standard:
// costruiamo uno shim minimale con un Headers object così la firma resta una.
function pickClientIp(headers: Record<string, string> | undefined): string {
  const fwd = headers?.["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) {
    return fwd.split(",")[0]!.trim();
  }
  const real = headers?.["x-real-ip"];
  return typeof real === "string" && real.length > 0 ? real : "anon";
}

function makeShimRequest(ip: string): Request {
  // Costruiamo un Request fittizio solo per esporre headers a rateLimit().
  // Usiamo un URL `http://shim/` puro: non viene mai dispatched, è solo
  // contenitore di headers.
  return new Request("http://shim/", { headers: { "x-forwarded-for": ip } });
}

// Provider-adapter pattern: GoogleProvider viene caricato SOLO se le env sono
// presenti, così localmente/in dev/in build non si rompe nulla quando l'OAuth
// non è configurato. Errore di sign-in lato client se utente clicca "Accedi
// con Google" ma il provider non c'è.
const googleProvider = process.env.GOOGLE_CLIENT_ID
  ? [
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      }),
    ]
  : [];

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/sign-in" },
  providers: [
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        totpCode: { label: "Codice 2FA", type: "text" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials.password) return null;
        const email = credentials.email.toLowerCase();
        const user = await db.user.findUnique({
          where: { email },
        });
        if (!user?.passwordHash) return null;
        const ok = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!ok) return null;

        // Step-up 2FA: se l'utente ha TOTP abilitato richiediamo il codice.
        // Il frontend rileva l'errore "2fa_required" e mostra l'input del
        // codice ri-chiamando signIn() con totpCode incluso.
        if (user.totpEnabled && user.totpSecret) {
          const rawCode = credentials.totpCode?.trim();
          if (!rawCode) {
            throw new Error("2fa_required");
          }

          // Rate-limit allo step 2FA: 5/5min per email+IP. Brute-force qui è
          // più pericoloso che su /verify perché il bucket lo paga il legit
          // user che ha sbagliato un dato. Combiniamo email+IP per non
          // condividere il bucket tra utenti dietro lo stesso proxy.
          const ip = pickClientIp(req?.headers as Record<string, string> | undefined);
          const rl = rateLimit(makeShimRequest(ip), {
            key: `signin-2fa:${email}`,
            max: 5,
            windowMs: 5 * 60_000,
          });
          if (!rl.ok) {
            throw new Error("too_many_attempts");
          }

          if (looksLikeRecoveryCode(rawCode)) {
            // Recovery code path: scambia un codice one-shot per accesso.
            const result = consumeRecoveryCode(user.recoveryCodesHash, rawCode);
            if (!result.ok) {
              throw new Error("2fa_invalid");
            }
            await db.user.update({
              where: { id: user.id },
              data: { recoveryCodesHash: result.remaining },
            });
            // Email security alert out-of-band: l'utente sta usando un codice
            // di emergenza, deve sapere SUBITO se non è stato lui (account
            // compromesso). Fire-and-forget, catch interno: un fallimento
            // dell'invio NON deve bloccare il login.
            void sendUserSecurityEmail({
              userId: user.id,
              kind: "2fa.recovery_code.used",
              metadata: {
                ip,
                userAgent:
                  (req?.headers as Record<string, string> | undefined)?.[
                    "user-agent"
                  ] ?? null,
                remaining: result.remaining.length,
              },
            });
            // Audit log dell'uso: dato che è la procedura di emergenza
            // vogliamo traccia chiara, incluso quanti codici restano.
            const orgId = (
              await db.orgMembership.findFirst({
                where: { userId: user.id },
                orderBy: { createdAt: "asc" },
                select: { orgId: true },
              })
            )?.orgId;
            if (orgId) {
              await logAudit({
                orgId,
                actorId: user.id,
                actorEmail: user.email,
                action: "user.2fa.recovery_code.consumed",
                entityType: "User",
                entityId: user.id,
                ip,
                diff: { remaining: { old: user.recoveryCodesHash.length, new: result.remaining.length } },
              });
            }
            // Recovery codes ≤ 3 → push in-app per l'utente. La Notification è
            // venue-scoped: scegliamo un venue dell'utente (qualunque va bene,
            // la vede solo lui via meta.userId). sourceId = userId+remaining
            // per dedupare la stessa soglia (es. due login con 2 codici
            // rimasti generano una sola notifica con sourceId user:2).
            if (result.remaining.length <= 3) {
              const membership = await db.venueMembership.findFirst({
                where: { userId: user.id },
                orderBy: { createdAt: "asc" },
                select: { venueId: true },
              });
              if (membership) {
                void pushNotification({
                  venueId: membership.venueId,
                  kind: "AUTH_RECOVERY_LOW",
                  title: "Codici di recupero quasi esauriti",
                  body: `Ti restano ${result.remaining.length} codici di recupero 2FA. Rigenerali dal profilo prima di rimanere senza.`,
                  link: "/settings/security",
                  userId: user.id,
                  sourceId: `${user.id}:${result.remaining.length}`,
                  metadata: { userId: user.id, remaining: result.remaining.length },
                });
              }
            }
          } else {
            if (!verifyTotp(user.totpSecret, rawCode)) {
              throw new Error("2fa_invalid");
            }
          }
        }

        return { id: user.id, email: user.email, name: user.name ?? undefined };
      },
    }),
    ...googleProvider,
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // Solo per OAuth: NextAuth v4 con JWT non ha database adapter, quindi
      // siamo noi a creare il User manualmente. Strategy: upsert per email,
      // così se l'utente esiste già (via password) il login Google lo "linka"
      // (semplicemente non lo ricrea). NON creiamo Organization/membership
      // automaticamente — l'utente atterra in "limbo" finché un Manager non
      // lo invita. L'onboarding di invito è fuori scope di questo flow.
      if (account?.provider === "google" && user.email) {
        const email = user.email.toLowerCase();
        const dbUser = await db.user.upsert({
          where: { email },
          create: {
            email,
            name: user.name ?? (profile as { name?: string } | undefined)?.name ?? null,
            image: user.image ?? null,
          },
          update: {},
        });
        // Sovrascrivo user.id col record DB così che `jwt` callback salvi
        // l'id Prisma in token.uid (e non l'id Google).
        user.id = dbUser.id;
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) token.uid = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.uid) (session.user as { id?: string }).id = token.uid as string;
      return session;
    },
  },
};

export function auth() {
  return getServerSession(authOptions);
}

export function isGoogleAuthEnabled(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}
