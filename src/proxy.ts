import { auth } from "@/lib/auth";

export default auth((req) => {
  const isApiRoute = req.nextUrl.pathname.startsWith("/api/");
  const isAuthRoute = req.nextUrl.pathname.startsWith("/api/auth/");

  if (isApiRoute && !isAuthRoute && !req.auth) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
});

export const config = {
  matcher: ["/api/:path*"],
};
