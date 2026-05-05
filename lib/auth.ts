import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { getUserByEmail, initSchema } from './db';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: { email: { label: 'Email', type: 'email' }, password: { label: 'Password', type: 'password' } },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        await initSchema();
        const user = await getUserByEmail(credentials.email);
        if (!user || !user.is_active) return null;
        const valid = await bcrypt.compare(credentials.password, user.password_hash as string);
        if (!valid) return null;
        return { id: String(user.id), name: user.name as string, email: user.email as string, role: user.role as string };
      },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user }) { if (user) token.role = (user as any).role; return token; },
    async session({ session, token }) {
      if (session.user) { (session.user as any).id = token.sub; (session.user as any).role = token.role; }
      return session;
    },
  },
  pages: { signIn: '/login' },
};
