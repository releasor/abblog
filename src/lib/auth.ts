import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { prisma } from "./prisma";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  username?: string;
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        type: { label: "Type", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const isAdminLogin = credentials.type === "admin";

        if (isAdminLogin) {
          // Admin login
          const user = await prisma.adminUser.findUnique({
            where: { email: credentials.email },
          });
          if (!user) return null;

          const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
          if (!isValid) return null;

          return {
            id: String(user.id),
            email: user.email,
            name: user.name,
            role: "admin",
          };
        } else {
          // Regular user login
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
          });
          if (!user) return null;

          const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
          if (!isValid) return null;

          return {
            id: String(user.id),
            email: user.email,
            name: user.name,
            role: "user",
            username: user.username || undefined,
          };
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.username = user.username;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.username = token.username;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export function getSessionUser(session: { user?: unknown } | null): SessionUser | null {
  if (!session?.user) return null;
  const user = session.user as { id?: string; name?: string | null; email?: string | null; role?: string; username?: string };
  if (!user.id || !user.role) return null;
  return {
    id: String(user.id),
    name: String(user.name || ""),
    email: String(user.email || ""),
    role: user.role as "admin" | "user",
    username: user.username,
  };
}

export { getAuthUserId, getAuthUserRole, getAuthUsername, isAdmin } from "./auth-helpers";
