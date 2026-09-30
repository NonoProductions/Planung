import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export default auth((req) => {
  const callbackUrl = `${req.nextUrl.pathname}${req.nextUrl.search}`;
  const isApiRoute = req.nextUrl.pathname.startsWith("/api/");
  const isAuthRoute = req.nextUrl.pathname.startsWith("/api/auth/");
  const isLoginRoute = req.nextUrl.pathname === "/login";
  const isMobileAuthRoute =
    req.nextUrl.pathname === "/api/mobile/login" ||
    req.nextUrl.pathname === "/api/mobile/refresh";
  // The iOS sync app sends a Bearer token; route handlers verify it via requireUserId.
  const hasBearer = req.headers.get("authorization")?.startsWith("Bearer ") ?? false;

  if (isAuthRoute || isLoginRoute || isMobileAuthRoute || req.auth || (isApiRoute && hasBearer)) {
    return;
  }

  if (isApiRoute) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("callbackUrl", callbackUrl);
  return NextResponse.redirect(loginUrl);
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
