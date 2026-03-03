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

export async function requireRoleOrRedirect(
  a: RouterLike | AllowedRolesInput,
  b: AllowedRolesInput | RouterLike,
  redirectTo: string = "/login"
): Promise<Profile | null> {
  const aIsRouter =
    !!a && typeof a === "object" &&
    (typeof (a as RouterLike).replace === "function" || typeof (a as RouterLike).push === "function");

  const bIsRouter =
    !!b && typeof b === "object" &&
    (typeof (b as RouterLike).replace === "function" || typeof (b as RouterLike).push === "function");

  const router: RouterLike | null = aIsRouter ? (a as RouterLike) : bIsRouter ? (b as RouterLike) : null;
  const allowedRoles: AllowedRolesInput = aIsRouter ? (b as AllowedRolesInput) : (a as AllowedRolesInput);

  const safeRedirect = (path: string) => {
    if (router?.replace) return router.replace(path);
    if (router?.push) return router.push(path);
    if (typeof window !== "undefined") window.location.href = path;
  };

  const rolesArray: Role[] = Array.isArray(allowedRoles) ? allowedRoles : allowedRoles ? [allowedRoles] : [];
  if (rolesArray.length === 0) { safeRedirect(redirectTo); return null; }

  const { data: sessData, error: sessErr } = await supabase.auth.getSession();
  if (sessErr || !sessData.session) { safeRedirect(redirectTo); return null; }

  const { data: authData, error: authErr } = await supabase.auth.getUser();
  if (authErr || !authData?.user) { safeRedirect(redirectTo); return null; }

  const { data: prof, error: profErr } = await supabase
    .from("profiles")
    .select("id, full_name, role, hotel_id, active")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profErr || !prof) { safeRedirect(redirectTo); return null; }
  if (prof.active === false) { safeRedirect(redirectTo); return null; }

  const role = normalizeRole(prof.role);
  const profile: Profile = {
    id: prof.id,
    full_name: prof.full_name ?? null,
    role,
    hotel_id: prof.hotel_id ?? null,
    active: prof.active ?? null,
  };

  if (!rolesArray.includes(profile.role)) { safeRedirect(redirectTo); return null; }
  return profile;
}