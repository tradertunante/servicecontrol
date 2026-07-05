import createIntlMiddleware from "next-intl/middleware";
import { NextFetchEvent, NextRequest, NextResponse } from "next/server";

import { checkRateLimitDistributed } from "@/lib/api/rateLimitDistributed";
import { logger } from "@/lib/logger";
import { routing } from "@/i18n/routing";

const AUTH_TOKEN_COOKIE = "sc-access-token";

const PUBLIC_API_PREFIXES = [
  "/api/auth/sync-session",
  "/api/trainings/sessions",
  "/api/trainings/attendances",
  "/api/billing/webhook",
  "/api/cal/webhook",
  "/api/trial/register",
  "/api/trial/track-login",
];

// Webhook paths are called server-to-server — skip CORS check for them
const WEBHOOK_PREFIXES = ["/api/billing/webhook", "/api/cal/webhook"];

// Server-to-server requests to superadmin API must include this header.
// Browser requests from our domain are already protected by CORS.
const SUPERADMIN_SECRET = process.env.SUPERADMIN_SECRET ?? "";

function isCorsViolation(origin: string | null, request: NextRequest): boolean {
  // No Origin header = server-to-server request (Stripe, cron, curl) — allow
  if (!origin) return false;

  // Same-origin: Origin matches the actual host serving the app
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  const proto = request.headers.get("x-forwarded-proto") || "https";
  if (origin === `${proto}://${host}`) return false;

  // Allow localhost in development
  if (origin === "http://localhost:3000" || origin === "http://localhost:3001") return false;

  return true;
}

const MARKETING_PATHS = ["/", "/pricing", "/demo", "/trial", "/founders"];

const intlMiddleware = createIntlMiddleware(routing);

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl;

  // Rate limit + CORS for API routes
  if (pathname.startsWith("/api/")) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const origin = request.headers.get("origin");

    // CORS: reject browser requests from unauthorized origins (skip for webhooks)
    const isWebhook = WEBHOOK_PREFIXES.some((p) => pathname.startsWith(p));
    if (!isWebhook && isCorsViolation(origin, request)) {
      event.waitUntil(
        logger.warn("cors_violation", { ip, pathname, origin }, { edgeContext: event })
      );
      return NextResponse.json(
        { ok: false, error: "No autorizado." },
        { status: 403 }
      );
    }

    // Superadmin API: server-to-server requests (no Origin) must include the secret header.
    // Browser requests from our domain are already covered by the CORS check above.
    const isSuperadminApi = pathname.startsWith("/api/superadmin/");
    if (isSuperadminApi && !origin && SUPERADMIN_SECRET) {
      const incomingSecret = request.headers.get("x-sc-internal");
      if (incomingSecret !== SUPERADMIN_SECRET) {
        event.waitUntil(
          logger.warn("superadmin_secret_missing", { ip, pathname }, { edgeContext: event })
        );
        return NextResponse.json(
          { ok: false, error: "No autorizado." },
          { status: 403 }
        );
      }
    }

    // sync-session is rate-limited per-user inside the handler — skip strict IP limit here
    const isSyncSession = pathname.startsWith("/api/auth/sync-session");
    const isAuthRoute = pathname.startsWith("/api/auth/") && !isSyncSession;
    const { allowed, retryAfterMs } = await checkRateLimitDistributed(ip, isAuthRoute ? "auth" : "general");

    if (!allowed) {
      event.waitUntil(
        logger.warn("rate_limit_exceeded", { ip, pathname, isAuthRoute }, { edgeContext: event })
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
      pathname.startsWith(`/${locale}/trial`) ||
      pathname.startsWith(`/${locale}/founders`)
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
  const cookieToken = request.cookies.get(AUTH_TOKEN_COOKIE)?.value;
  const bearerToken = (() => {
    const h = request.headers.get("authorization") || "";
    return h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  })();
  const token = cookieToken || bearerToken;

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
    "/mystery-shopper/:path*",
    "/otros/:path*",
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
