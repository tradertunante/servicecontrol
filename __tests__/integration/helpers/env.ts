// Detección de entorno para los tests de integración.
// Nunca imprimas los valores de estas variables en logs.

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/** Opt-in explícito: evita que otro runner ejecute estos tests por accidente. */
export const integrationEnabled =
  process.env.RUN_SUPABASE_INTEGRATION === "1" &&
  Boolean(SUPABASE_URL) &&
  Boolean(SUPABASE_ANON_KEY) &&
  Boolean(SUPABASE_SERVICE_ROLE_KEY);

export function describeMissingEnv(): string {
  const missing: string[] = [];
  if (process.env.RUN_SUPABASE_INTEGRATION !== "1") missing.push("RUN_SUPABASE_INTEGRATION=1");
  if (!SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!SUPABASE_ANON_KEY) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  return missing.join(", ");
}

/**
 * URL base del servidor Next.js corriendo localmente.
 * Requerido para los tests de autorización de rutas HTTP.
 * Ej: TEST_BASE_URL=http://localhost:3000
 */
export const TEST_BASE_URL = process.env.TEST_BASE_URL ?? "";

/** Opt-in para los tests de rutas HTTP (requieren servidor corriendo). */
export const routeTestsEnabled =
  integrationEnabled && Boolean(TEST_BASE_URL);

/** Dominio reservado para usuarios de test: el sweep de limpieza borra por este sufijo. */
export const TEST_EMAIL_DOMAIN = "sc-integration-tests.dev";

/** Prefijo reservado para entidades de test: el sweep de limpieza borra por este prefijo. */
export const TEST_NAME_PREFIX = "[IT]";