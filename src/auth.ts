import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import CredentialsProvider from "next-auth/providers/credentials"
import { getPrisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  trustHost: true,
  pages: {
    signIn: '/admin/login',
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: "Admin Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        
        const prisma = getPrisma();
        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string }
        });

        if (user && user.role === "ADMIN" && user.password) {
          const isValid = await bcrypt.compare(credentials.password as string, user.password);
          if (isValid) {
            return { id: user.id, name: user.name, email: user.email, image: user.image, role: user.role };
          }
        }
        return null;
      }
    })
  ],
  session: {
    strategy: "jwt"
  },
  callbacks: {
    /**
     * signIn callback: auto-create or link the User row in DB
     * when signing in via Google OAuth for the first time.
     */
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        try {
          const prisma = getPrisma();
          let dbUser = await prisma.user.findUnique({
            where: { email: user.email! },
          });

          if (!dbUser) {
            dbUser = await prisma.user.create({
              data: {
                email: user.email!,
                name: user.name || "",
                image: user.image || "",
                role: "USER",
                balance: 0,
              },
            });
          }

          // Store DB user id on the user object so jwt() can read it
          user.id = dbUser.id;

          // Also ensure the Account link exists (for NextAuth)
          try {
            const existingAccount = await prisma.account.findUnique({
              where: {
                provider_providerAccountId: {
                  provider: account.provider,
                  providerAccountId: account.providerAccountId,
                },
              },
            });
            if (!existingAccount) {
              await prisma.account.create({
                data: {
                  userId: dbUser.id,
                  type: account.type as string,
                  provider: account.provider,
                  providerAccountId: account.providerAccountId,
                  access_token: account.access_token,
                  refresh_token: account.refresh_token,
                  expires_at: account.expires_at,
                  token_type: account.token_type,
                  scope: account.scope,
                  id_token: account.id_token,
                },
              });
            }
          } catch (accountErr) {
            console.warn("[auth] Account link skipped:", accountErr);
          }
        } catch (err) {
          console.error("[auth] signIn DB error (non-fatal):", err);
        }
      }
      return true;
    },

    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.picture = user.image
        token.role = (user as any).role || "USER"
      }
      return token
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        (session.user as any).role = token.role as string
      }
      return session
    }
  }
})
