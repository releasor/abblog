import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth({
  callbacks: {
    authorized: ({ token, req }) => {
      const path = req.nextUrl.pathname;

      // Allow access to login page without auth
      if (path === "/admin/login") {
        return true;
      }

      // All other /admin/* routes require auth
      return !!token;
    },
  },
});

export const config = {
  matcher: ["/admin/:path*"],
};
