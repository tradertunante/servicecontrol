import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } from "./env";

export type Db = SupabaseClient<Database>;

let _admin: Db | null = null;

/** Cliente service-role: salta RLS. Solo para setup/teardown y RPCs server-side. */
export function adminClient(): Db {
  if (_admin) return _admin;
  _admin = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}

/** Cliente anónimo sin sesión: simula un visitante no autenticado. */
export function anonClient(): Db {
  return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Cliente autenticado como un usuario concreto: las queries pasan por RLS. */
export async function signedInClient(email: string, password: string): Promise<Db> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(`No se pudo iniciar sesión como ${email}: ${error.message}`);
  }
  return client;
}

/** Lanza si la operación de setup falló: los fixtures nunca deben quedar a medias. */
export function must<T>(
  result: { data: T; error: { message: string } | null },
  context: string
): NonNullable<T> {
  if (result.error) throw new Error(`${context}: ${result.error.message}`);
  if (result.data == null) throw new Error(`${context}: respuesta vacía`);
  return result.data as NonNullable<T>;
}