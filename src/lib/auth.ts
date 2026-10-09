import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PHP_API_URL } from "./api-client";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        try {
          const res = await fetch(`${PHP_API_URL}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });

          if (!res.ok) return null;

          const data = await res.json();
          if (!data.token || !data.user) return null;

          return {
            id: data.user.id,
            name: data.user.name,
            email: data.user.email,
            role: data.user.role,
            entityKeys: data.user.entityKeys ?? [],
            phpToken: data.token,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = (user as any).id;
        token.role = (user as any).role;
        token.entityKeys = (user as any).entityKeys ?? [];
        token.phpToken = (user as any).phpToken;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub;
        (session.user as any).role = token.role;
        (session.user as any).entityKeys = token.entityKeys ?? [];
        (session.user as any).phpToken = token.phpToken;
      }
      return session;
    },
  },
};

/** Tetap tersedia untuk backward compatibility di tempat yang masih import resolveStaffId */
export async function resolveStaffId(_userId?: string, _userEmail?: string | null): Promise<string> {
  // Tidak lagi query Prisma — ID sudah ada di session
  return _userId ?? "";
}
