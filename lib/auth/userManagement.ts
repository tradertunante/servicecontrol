import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { canAssignRole, normalizeRole, type Role } from "@/lib/auth/permissions";
import { resolveRouteHotelScope } from "@/lib/auth/server";
import type { Profile } from "@/lib/types";

export type ManagedUserRow = {
  id: string;
  hotel_id: string | null;
  role: Role;
  active: boolean;
  full_name: string | null;
  email: string | null;
};

const KNOWN_ROLES: Role[] = [
  "superadmin",
  "admin",
  "general_manager",
  "manager",
  "auditor",
  "quality",
  "engineering",
  "it",
  "systems",
];

export function resolveManagedHotelId(profile: Profile, requestedHotelId?: string | null) {
  return resolveRouteHotelScope(profile, requestedHotelId ?? null);
}

export function assertRoleAssignable(actorRole: Role, requestedRole: unknown) {
  const rawRole = String(requestedRole ?? "").trim().toLowerCase();
  if (!KNOWN_ROLES.includes(rawRole as Role)) {
    return {
      ok: false as const,
      error: "Rol inválido.",
      status: 400,
    };
  }

  const normalizedRole = normalizeRole(rawRole);
  if (!canAssignRole(actorRole, normalizedRole)) {
    return {
      ok: false as const,
      error: `No puedes asignar el rol "${normalizedRole}".`,
      status: 403,
    };
  }

  return { ok: true as const, role: normalizedRole };
}

export function canManageExistingUser(actorRole: Role, targetRole: Role) {
  if (actorRole === "superadmin") return true;
  if (actorRole === "admin") return targetRole !== "superadmin";
  return false;
}

export async function loadManagedUser(userId: string, hotelId?: string | null) {
  const admin = supabaseAdmin();
  let query = admin
    .from("profiles")
    .select("id, hotel_id, role, active, full_name, email")
    .eq("id", userId)
    .limit(1);

  if (hotelId) {
    query = query.eq("hotel_id", hotelId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return {
    id: String(data.id),
    hotel_id: (data.hotel_id as string | null) ?? null,
    role: normalizeRole(data.role),
    active: data.active ?? true,
    full_name: (data.full_name as string | null) ?? null,
    email: (data.email as string | null) ?? null,
  } satisfies ManagedUserRow;
}
