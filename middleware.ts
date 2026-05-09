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
  "/api/trial/register",
];

const MARKETING_PATHS = ["/", "/pricing", "/demo", "/trial"];

const intlMiddleware = createIntlMiddleware(routing);

export function middleware(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl;

  // Rate limit API routes
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

  // Redirect locale-prefixed auth routes to their canonical paths
  const AUTH_ROUTES = ["/login", "/forgot-password", "/reset-password", "/register"];
  for (const locale of routing.locales) {
    for (const route of AUTH_ROUTES) {
      if (pathname === `/${locale}${route}`) {
        const url = request.nextUrl.clone();
        url.pathname = route;
        return NextResponse.redirect(url);
      }
    }
  }

  // Handle locale routing for marketing pages
  const isMarketingPath =
    MARKETING_PATHS.includes(pathname) ||
    routing.locales.some((locale) =>
      pathname === `/${locale}` ||
      pathname.startsWith(`/${locale}/pricing`) ||
      pathname.startsWith(`/${locale}/demo`) ||
      pathname.startsWith(`/${locale}/trial`)
    );

  if (isMarketingPath) {
    const response = intlMiddleware(request);
    // Propagate locale to the app cookie so the authenticated app inherits the language
    const detectedLocale = routing.locales.find((l) => pathname.startsWith(`/${l}`)) ?? routing.defaultLocale;
    response.cookies.set("sc-locale", detectedLocale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
    return response;
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
