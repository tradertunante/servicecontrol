// lib/auth/RequireRole.ts
import { supabase } from "@/lib/supabaseClient";
import { normalizeRole, type Role } from "@/lib/auth/permissions";

export type Profile = {
  id: string;
  full_name: string | null;
  role: Role;
  hotel_id: string | null;
  active?: boolean | null;
};

type RouterLike = { replace?: (path: string) => void; push?: (path: string) => void };
type AllowedRolesInput = Role[] | Role | undefined | null;

/**
 * Carga el profile del usuario logueado y valida role.
 * Si no cumple, redirige.
 *
 * Soporta llamadas en ambos órdenes:
 *  - requireRoleOrRedirect(router, ["admin","superadmin"])
 *  - requireRoleOrRedirect(["admin","superadmin"], router)
 */
export async function requireRoleOrRedirect(
  a: RouterLike | AllowedRolesInput,
  b: AllowedRolesInput | RouterLike,
  redirectTo: string = "/login"
): Promise<Profile | null> {
  // Detecta orden de argumentos
  const aIsRouter = !!a && typeof a === "object" && typeof (a as RouterLike).replace === "function";
  const bIsRouter = !!b && typeof b === "object" && typeof (b as RouterLike).replace === "function";

  const router: RouterLike | null = aIsRouter
    ? (a as RouterLike)
    : bIsRouter
      ? (b as RouterLike)
      : null;

  const allowedRoles: AllowedRolesInput = aIsRouter ? (b as AllowedRolesInput) : (a as AllowedRolesInput);

  const safeRedirect = (path: string) => {
    if (router?.replace) return router.replace(path);
    if (router?.push) return router.push(path);
    // fallback ultra-seguro (cliente)
    if (typeof window !== "undefined") window.location.href = path;
  };

  // Normaliza roles SIEMPRE a array
  const rolesArray: Role[] = Array.isArray(allowedRoles)
    ? allowedRoles
    : allowedRoles
      ? [allowedRoles]
      : [];

  // Si no hay router válido, al menos evita explotar
  if (!router && typeof window === "undefined") {
    // En server no podemos redirigir con window ni router
    return null;
  }

  // 1) session
  const { data: sessData } = await supabase.auth.getSession();
  if (!sessData.session) {
    safeRedirect(redirectTo);
    return null;
  }

  // 2) user
  const { data: authData, error: authErr } = await supabase.auth.getUser();
  if (authErr || !authData?.user) {
    safeRedirect(redirectTo);
    return null;
  }

  // 3) profile
  const { data: prof, error: profErr } = await supabase
    .from("profiles")
    .select("id, full_name, role, hotel_id, active")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profErr || !prof) {
    safeRedirect(redirectTo);
    return null;
  }

  if (prof.active === false) {
    safeRedirect(redirectTo);
    return null;
  }

  const role = normalizeRole(prof.role);

  const profile: Profile = {
    id: prof.id,
    full_name: prof.full_name ?? null,
    role,
    hotel_id: prof.hotel_id ?? null,
    active: prof.active ?? null,
  };

  // Seguridad: si no pasan roles, bloquea
  if (rolesArray.length === 0) {
    safeRedirect(redirectTo);
    return null;
  }

  if (!rolesArray.includes(profile.role)) {
    safeRedirect(redirectTo);
    return null;
  }

  return profile;
}