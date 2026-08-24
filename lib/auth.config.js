// Edge-safe base config (no providers, no bcrypt/Prisma) so the proxy can
// check auth without pulling Node-only code into the Edge runtime bundle.
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnLogin = nextUrl.pathname.startsWith("/login");
      if (isOnLogin) {
        if (isLoggedIn) return Response.redirect(new URL("/", nextUrl));
        return true;
      }
      return isLoggedIn;
    },
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.username = user.username;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId;
        session.user.username = token.username;
        // Advisory only, and deliberately not defaulted: lib/permissions.js
        // reads the role from the database on every check, because a token
        // minted before this claim existed carries no role and must not be
        // able to imply one.
        session.user.role = token.role || null;
      }
      return session;
    },
  },
  providers: [], // real provider added in lib/auth.js
};
