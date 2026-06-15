import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";

const DEFAULT_CATEGORIES = [
  { name: "Work", color: "#4a9eff", isDefault: true },
  { name: "Personal", color: "#a78bfa", isDefault: true },
];

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt" },
  trustHost: true,
  pages: { signIn: "/" },
  callbacks: {
    async jwt({ token }) {
      // First time this token is seen: sync the Google identity to our User row
      if (token.email && !token.uid) {
        const isFirstUser = (await prisma.user.count()) === 0;
        const user = await prisma.user.upsert({
          where: { email: token.email },
          update: { name: token.name ?? null, image: (token.picture as string | null) ?? null },
          create: {
            email: token.email,
            name: token.name ?? null,
            image: (token.picture as string | null) ?? null,
          },
        });
        if (isFirstUser) {
          // Entries and categories created before accounts existed belong to
          // the very first person to sign in
          await prisma.entry.updateMany({ where: { userId: null }, data: { userId: user.id } });
          await prisma.category.updateMany({ where: { userId: null }, data: { userId: user.id } });
        }
        const hasCategories = await prisma.category.count({ where: { userId: user.id } });
        if (hasCategories === 0) {
          await prisma.category.createMany({
            data: DEFAULT_CATEGORIES.map(c => ({ ...c, userId: user.id })),
          });
        }
        token.uid = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (token.uid) session.user.id = token.uid as string;
      return session;
    },
  },
});

// Convenience for API routes: resolved user id or null
export async function sessionUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}
