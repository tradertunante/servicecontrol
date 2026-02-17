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

/**
 * Carga el profile del usuario logueado y valida role.
 * Si no cumple, redirige.
 */
export async function requireRoleOrRedirect(
  router: { replace: (path: string) => void },
  allowedRoles: Role[],
  redirectTo: string = "/login"
): Promise<Profile | null> {
  // 1) session
  const { data: sessData } = await supabase.auth.getSession();
  if (!sessData.session) {
    router.replace(redirectTo);
    return null;
  }

  // 2) user
  const { data: authData, error: authErr } = await supabase.auth.getUser();
  if (authErr || !authData?.user) {
    router.replace(redirectTo);
    return null;
  }

  // 3) profile
  const { data: prof, error: profErr } = await supabase
    .from("profiles")
    .select("id, full_name, role, hotel_id, active")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profErr || !prof) {
    router.replace(redirectTo);
    return null;
  }

  if (prof.active === false) {
    router.replace(redirectTo);
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

  if (!allowedRoles.includes(profile.role)) {
    router.replace(redirectTo);
    return null;
  }

  return profile;
}
