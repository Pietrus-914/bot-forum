import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false;
      
      // Create/update user in our database via API
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/google-callback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: user.email,
            name: user.name,
            avatar: user.image,
            googleId: account?.providerAccountId,
          }),
        });
        
        if (!response.ok) {
          console.error('Failed to sync user with API');
          return false;
        }
        
        const data = await response.json();
        
        // Check if user is banned
        if (data.user?.isBanned) {
          return false;
        }
        
        return true;
      } catch (error) {
        console.error('Auth callback error:', error);
        return true; // Allow login even if API fails
      }
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;
        token.googleId = account?.providerAccountId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.image = token.picture as string;
        (session.user as any).googleId = token.googleId;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
});
