// lib/supabaseServer.ts
// Helper server-side para crear clientes Supabase sin depender de lib/config.ts
import "server-only";
import { createClient } from "@supabase/supabase-js";

function getEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!anonKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return { url, anonKey };
}

/** Cliente con el token del usuario — para validar identidad y respetar RLS */
export function supabaseWithToken(token: string) {
  const { url, anonKey } = getEnv();
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
}