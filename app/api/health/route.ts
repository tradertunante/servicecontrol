import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Health check público para uptime monitors (Better Stack) y probes de
// orquestadores. No expone detalles internos: solo estado agregado, commit
// desplegado y latencia del check a Supabase.

const SUPABASE_CHECK_TIMEOUT_MS = 3_000;

async function checkSupabase(): Promise<{ ok: boolean; latency_ms: number }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return { ok: false, latency_ms: 0 };

  const started = Date.now();
  try {
    const res = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: anonKey },
      signal: AbortSignal.timeout(SUPABASE_CHECK_TIMEOUT_MS),
      cache: "no-store",
    });
    return { ok: res.ok, latency_ms: Date.now() - started };
  } catch {
    return { ok: false, latency_ms: Date.now() - started };
  }
}

export async function GET() {
  const supabase = await checkSupabase();
  const healthy = supabase.ok;

  return NextResponse.json(
    {
      ok: healthy,
      status: healthy ? "healthy" : "degraded",
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
      checks: {
        supabase: { ok: supabase.ok, latency_ms: supabase.latency_ms },
      },
    },
    {
      status: healthy ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
