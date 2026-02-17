// lib/auth/RequireRole.ts
import { supabase } from "@/lib/supabaseClient";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

export type Role = "superadmin" | "admin" | "manager" | "auditor";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  hotel_id: string | null;
  active: boolean | null;
};

export async function requireRoleOrRedirect(
  router: AppRouterInstance,
  allowedRoles: Role[],
  redirectTo = "/login"
): Promise<Profile | null> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) {
    router.replace(redirectTo);
    return null;
  }

  const uid = userData.user.id;

  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("id,email,full_name,role,hotel_id,active")
    .eq("id", uid)
    .maybeSingle();

  if (pErr) throw new Error(`No se pudo cargar el perfil (profiles): ${pErr.message}`);
  if (!profile) throw new Error(`No existe perfil para uid=${uid}`);

  if (profile.active === false) {
    router.replace(redirectTo);
    return null;
  }

  if (!allowedRoles.includes(profile.role)) {
    router.replace(redirectTo);
    return null;
  }

  return profile as Profile;
}
