// lib/auth/RequireRole.ts
"use client";

import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { supabase } from "@/lib/supabaseClient";

export type Role = "admin" | "manager" | "auditor";

export type Profile = {
  id: string;
  hotel_id: string;
  role: Role;
  active: boolean;
  full_name?: string | null;
};

function normalizeAllowed(allowed?: Role | Role[] | readonly Role[] | Set<Role>): Role[] {
  if (!allowed) return [];
  if (Array.isArray(allowed)) return [...allowed];
  if (allowed instanceof Set) return Array.from(allowed);
  if (typeof allowed === "string") return [allowed];
  return [];
}

/**
 * Client guard:
 * - Obtiene user + profile
 * - Si falla → router.replace(redirectTo) y devuelve null
 * - Si allowed se pasa y no incluye el rol → router.replace(...) y null
 * - Si ok → devuelve Profile
 */
export async function requireRoleOrRedirect(
  router: AppRouterInstance,
  allowed?: Role | Role[] | readonly Role[] | Set<Role>,
  redirectTo: string = "/areas"
): Promise<Profile | null> {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    router.replace(redirectTo);
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, hotel_id, role, active, full_name")
    .eq("id", user.id)
    .single();

  if (error || !data) {
    router.replace(redirectTo);
    return null;
  }

  if (data.active === false) {
    router.replace(redirectTo);
    return null;
  }

  const profile = data as Profile;

  const allowedArr = normalizeAllowed(allowed);
  if (allowedArr.length > 0 && !allowedArr.includes(profile.role)) {
    router.replace(redirectTo);
    return null;
  }

  return profile;
}
