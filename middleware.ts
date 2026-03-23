import { NextRequest, NextResponse } from "next/server";

const AUTH_TOKEN_COOKIE = "sc-access-token";

const PUBLIC_API_PREFIXES = [
  "/api/auth/sync-session",
  "/api/trainings/sessions",
  "/api/trainings/attendances",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_TOKEN_COOKIE)?.value;

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { ok: false, error: "No autorizado." },
        { status: 401 }
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/analytics/:path*",
    "/areas/:path*",
    "/audits/:path*",
    "/builder/:path*",
    "/dashboard/:path*",
    "/engineering/:path*",
    "/formaciones/:path*",
    "/home/:path*",
    "/it/:path*",
    "/members/:path*",
    "/my/:path*",
    "/profile/:path*",
    "/reports/:path*",
    "/standards/:path*",
    "/task/:path*",
    "/team/:path*",
    "/users/:path*",
    "/superadmin/:path*",
    "/api/:path*",
  ],
};
