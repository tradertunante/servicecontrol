import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Singleton en navegador para evitar que StackBlitz cree varios clientes y “pierda” sesión
declare global {
  // eslint-disable-next-line no-var
  var __supabase__: SupabaseClient | undefined;
}

function makeClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      // En StackBlitz ayuda mucho declarar storage explícito
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
      storageKey: "servicecontrol-auth",
    },
  });
}

export const supabase =
  typeof window !== "undefined"
    ? (globalThis.__supabase__ ?? (globalThis.__supabase__ = makeClient()))
    : makeClient();
