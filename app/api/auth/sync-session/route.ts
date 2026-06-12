import { NextRequest, NextResponse } from "next/server";

import { AUTH_TOKEN_COOKIE } from "@/lib/auth/cookies";
import { checkRateLimitDistributed } from "@/lib/api/rateLimitDistributed";
import { supabaseWithToken } from "@/lib/supabaseServer";

function extractJwtSub(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
    return typeof json.sub === "string" ? json.sub : null;
  } catch {
    return null;
  }
}

function buildCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

/**
 * POST — Sync the Supabase access token into an httpOnly cookie.
 * Called by AuthSessionSync on the client after login / token refresh.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  const expiresAt: number | null =
    typeof body?.expires_at === "number" && Number.isFinite(body.expires_at)
      ? body.expires_at
      : null;

  const response = NextResponse.json({ ok: true });

  if (!token) {
    response.cookies.set(AUTH_TOKEN_COOKIE, "", {
      ...buildCookieOptions(),
      maxAge: 0,
    });
    return response;
  }

  // Per-user rate limit: 5 refreshes/min. Keyed by JWT sub so hotel shared IPs don't collide.
  const userId = extractJwtSub(token);
  if (userId) {
    const { allowed, retryAfterMs } = await checkRateLimitDistributed(userId, "auth");
    if (!allowed) {
      return NextResponse.json(
        { ok: false, error: "Demasiadas solicitudes. Intenta de nuevo en un momento." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((retryAfterMs ?? 60000) / 1000)) } },
      );
    }
  }

  // Only persist tokens that Supabase recognizes — rejects garbage/forged values
  const { data, error } = await supabaseWithToken(token).auth.getUser(token);
  if (error || !data?.user) {
    return NextResponse.json({ ok: false, error: "Token inválido." }, { status: 401 });
  }

  response.cookies.set(AUTH_TOKEN_COOKIE, token, {
    ...buildCookieOptions(),
    ...(expiresAt ? { expires: new Date(expiresAt * 1000) } : {}),
  });

  return response;
}
