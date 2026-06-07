import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { createUser, findUserByEmail, normEmail } from '@/lib/auth';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID || process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || process.env.AUTH_GOOGLE_SECRET,
      authorization: {
        params: { prompt: 'select_account' },
      },
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider === 'google') {
        const email = normEmail(profile?.email || '');
        if (!email) return false;

        const allowedDomains = process.env.GOOGLE_ALLOWED_DOMAINS;
        if (allowedDomains) {
          const domains = allowedDomains.split(',').map((d) => d.trim().toLowerCase());
          const domain = email.split('@')[1]?.toLowerCase();
          if (!domain || !domains.includes(domain)) return false;
        }
      }
      return true;
    },
    async jwt({ token, account, profile }) {
      if (account?.provider === 'google') {
        const email = normEmail(profile?.email || '');
        if (!email) return token;

        let user = await findUserByEmail(email);
        if (!user) {
          const userId = await createUser({
            email,
            password: 'oauth:google',
            name: profile?.name || email.split('@')[0],
            role: 'user',
          });
          user = { id: userId, email, name: profile?.name || email.split('@')[0], role: 'user' };
        }

        token.userId = user.id;
        token.email = user.email;
        token.name = user.name;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.userId) {
        session.user = {
          ...session.user,
          id: token.userId,
          email: token.email,
          name: token.name,
          role: token.role,
        };
      }
      return session;
    },
  },
  pages: {
    signIn: '/admin',
  },
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60,
  },
});
