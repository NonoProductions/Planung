import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export default auth((req) => {
  const callbackUrl = `${req.nextUrl.pathname}${req.nextUrl.search}`;
  const isApiRoute = req.nextUrl.pathname.startsWith("/api/");
  const isAuthRoute = req.nextUrl.pathname.startsWith("/api/auth/");
  const isLoginRoute = req.nextUrl.pathname === "/login";

  if (isAuthRoute || isLoginRoute || req.auth) {
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
