import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { db } from "./db";
import { verifyTotp } from "./totp";

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
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;
        const user = await db.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
        });
        if (!user?.passwordHash) return null;
        const ok = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!ok) return null;

        // Step-up 2FA: se l'utente ha TOTP abilitato richiediamo il codice.
        // Il frontend rileva l'errore "2fa_required" e mostra l'input del
        // codice ri-chiamando signIn() con totpCode incluso.
        if (user.totpEnabled && user.totpSecret) {
          const code = credentials.totpCode?.trim();
          if (!code) {
            throw new Error("2fa_required");
          }
          if (!verifyTotp(user.totpSecret, code)) {
            throw new Error("2fa_invalid");
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
