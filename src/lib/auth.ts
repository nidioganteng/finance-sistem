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
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub;
        (session.user as any).role = token.role;
        (session.user as any).entityKeys = token.entityKeys;
      }
      return session;
    },
  },
};
