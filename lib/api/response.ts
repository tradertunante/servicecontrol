import { NextResponse } from "next/server";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

/**
 * Log the real Supabase/DB error server-side and return a safe message to the client.
 * Prevents leaking internal details (table names, constraints, connection info).
 */
export function jsonDbError(
  error: { message?: string; code?: string; details?: string; hint?: string } | null,
  fallback = "Error interno del servidor.",
  status = 500,
) {
  console.error("[DB Error]", {
    message: error?.message,
    code: error?.code,
    details: error?.details,
    hint: error?.hint,
  });
  return NextResponse.json({ ok: false, error: fallback }, { status });
}

export function jsonOk<T extends Record<string, unknown>>(data: T) {
  return NextResponse.json({ ok: true, ...data });
}
