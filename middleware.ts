import createIntlMiddleware from "next-intl/middleware";
import { NextFetchEvent, NextRequest, NextResponse } from "next/server";

import { checkRateLimit } from "@/lib/api/rateLimit";
import { logger } from "@/lib/logger";
import { routing } from "@/i18n/routing";

const AUTH_TOKEN_COOKIE = "sc-access-token";

const PUBLIC_API_PREFIXES = [
  "/api/auth/sync-session",
  "/api/trainings/sessions",
  "/api/trainings/attendances",
  "/api/billing/webhook",
];

// Marketing paths that need locale routing (without locale prefix)
const MARKETING_PATHS = ["/", "/pricing", "/demo"];

const intlMiddleware = createIntlMiddleware(routing);

export function middleware(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl;

  // Rate limit API routes (100 req/min per IP)
  if (pathname.startsWith("/api/")) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const { allowed, retryAfterMs } = checkRateLimit(ip);
    if (!allowed) {
      event.waitUntil(
        logger.warn("rate_limit_exceeded", { ip, pathname }, { edgeContext: event })
      );
      return NextResponse.json(
        { ok: false, error: "Demasiadas solicitudes. Intenta de nuevo en un momento." },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil((retryAfterMs ?? 60000) / 1000)) },
        },
      );
    }
  }

  if (PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Handle locale routing for marketing pages
  const isMarketingPath =
    MARKETING_PATHS.includes(pathname) ||
    routing.locales.some((locale) =>
      pathname === `/${locale}` ||
      pathname.startsWith(`/${locale}/pricing`) ||
      pathname.startsWith(`/${locale}/demo`)
    );

  if (isMarketingPath) {
    return intlMiddleware(request);
  }

  // Auth guard for protected app routes
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
    "/",
    "/(en|es)/:path*",
    "/admin/:path*",
    "/analytics/:path*",
    "/areas/:path*",
    "/audits/:path*",
    "/billing/:path*",
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
