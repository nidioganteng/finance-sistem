import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

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

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { entityAccess: { include: { entity: true } } },
        });

        if (!user || user.status !== "ACTIVE" || !user.role) return null;

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          entityKeys: user.entityAccess.map((a) => a.entity.key),
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // `user` hanya ada saat login pertama kali; setelah itu ambil dari token.
      if (user) {
        token.role = (user as any).role;
        token.entityKeys = (user as any).entityKeys;
      } else if (token.email) {
        // Sync token ID with DB in case of reseed/DB migration
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email },
          select: { id: true, role: true, entityAccess: { select: { entity: { select: { key: true } } } } },
        });
        if (dbUser) {
          token.sub = dbUser.id;
          if (dbUser.role) token.role = dbUser.role;
          token.entityKeys = dbUser.entityAccess.map((a) => a.entity.key);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        let userId = token.sub;
        if (session.user.email) {
          const dbUser = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true, role: true, entityAccess: { select: { entity: { select: { key: true } } } } },
          });
          if (dbUser) {
            userId = dbUser.id;
            if (dbUser.role) (session.user as any).role = dbUser.role;
            (session.user as any).entityKeys = dbUser.entityAccess.map((a) => a.entity.key);
          }
        }
        (session.user as any).id = userId;
      }
      return session;
    },
  },
};

export async function resolveStaffId(userId?: string, userEmail?: string | null): Promise<string> {
  if (userId) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (user) return user.id;
  }
  if (userEmail) {
    const user = await prisma.user.findUnique({ where: { email: userEmail }, select: { id: true } });
    if (user) return user.id;
  }
  const fallback = await prisma.user.findFirst({ select: { id: true } });
  if (fallback) return fallback.id;
  throw new Error("Tidak ditemukan akun staf/pengguna yang valid di database.");
}
