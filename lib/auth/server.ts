import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabaseWithToken } from "@/lib/supabaseServer";
import type { Profile } from "@/lib/types";
import { AUTH_TOKEN_COOKIE, HOTEL_SCOPE_COOKIE } from "@/lib/auth/cookies";
import {
  canAccessModule,
  getDefaultHotelRouteByRole,
  getModuleRoles,
  hasPermission,
  normalizeRole,
  type AuthorizationModule,
  type Permission,
  type Role,
} from "@/lib/auth/permissions";

export type AuthContext = {
  token: string;
  profile: Profile;
};

export type RequestAuthContext = AuthContext & {
  requestedHotelId: string | null;
};

export type ScopedHotelResult =
  | { ok: true; hotelId: string }
  | { ok: false; error: string; status: number };

type BasicProfileRow = {
  id: string;
  full_name: string | null;
  role: string | null;
  hotel_id: string | null;
  active: boolean | null;
};

function getLoginRedirect(nextPath?: string) {
  if (!nextPath) return "/login";
  return `/login?next=${encodeURIComponent(nextPath)}`;
}

function normalizeProfile(row: BasicProfileRow): Profile {
  return {
    id: row.id,
    full_name: row.full_name ?? null,
    role: normalizeRole(row.role),
    hotel_id: row.hotel_id ?? null,
    active: row.active ?? null,
  };
}

async function loadProfileWithToken(token: string): Promise<Profile | null> {
  const client = supabaseWithToken(token);
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser(token);

  if (authError || !user) return null;

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("id, full_name, role, hotel_id, active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) return null;

  const normalized = normalizeProfile(profile as BasicProfileRow);
  if (normalized.active === false) return null;
  return normalized;
}

function readCookie(name: string): string | null {
  const value = cookies().get(name)?.value?.trim();
  return value || null;
}

export function getServerAccessToken() {
  return readCookie(AUTH_TOKEN_COOKIE);
}

export function getServerSelectedHotelId() {
  return readCookie(HOTEL_SCOPE_COOKIE);
}

export function getBearerTokenFromRequest(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }

  const cookieToken = request.cookies.get(AUTH_TOKEN_COOKIE)?.value?.trim();
  return cookieToken || "";
}

export async function requireAuthenticatedUser(nextPath?: string): Promise<AuthContext> {
  const token = getServerAccessToken();
  if (!token) redirect(getLoginRedirect(nextPath));

  const profile = await loadProfileWithToken(token);
  if (!profile) redirect(getLoginRedirect(nextPath));

  return { token, profile };
}

export async function requireProfile(nextPath?: string) {
  return requireAuthenticatedUser(nextPath);
}

export async function requireRole(
  roles: readonly Role[],
  options?: { nextPath?: string; redirectTo?: string }
) {
  const auth = await requireAuthenticatedUser(options?.nextPath);

  if (!roles.includes(auth.profile.role)) {
    redirect(options?.redirectTo ?? getDefaultHotelRouteByRole(auth.profile.role));
  }

  return auth;
}

export async function requirePermission(
  permission: Permission,
  options?: { nextPath?: string; redirectTo?: string }
) {
  const auth = await requireAuthenticatedUser(options?.nextPath);

  if (!hasPermission(auth.profile.role, permission)) {
    redirect(options?.redirectTo ?? getDefaultHotelRouteByRole(auth.profile.role));
  }

  return auth;
}

export async function requireModuleAccess(
  module: AuthorizationModule,
  options?: { nextPath?: string; redirectTo?: string }
) {
  const auth = await requireAuthenticatedUser(options?.nextPath);

  if (!canAccessModule(auth.profile.role, module)) {
    redirect(options?.redirectTo ?? getDefaultHotelRouteByRole(auth.profile.role));
  }

  return auth;
}

export function resolveScopedHotelId(profile: Profile, requestedHotelId?: string | null) {
  if (profile.role === "superadmin") {
    const hotelId = requestedHotelId ?? getServerSelectedHotelId();
    if (!hotelId) redirect("/superadmin/hotels");
    return hotelId;
  }

  if (!profile.hotel_id) {
    redirect("/login");
  }

  if (requestedHotelId && requestedHotelId !== profile.hotel_id) {
    redirect(getDefaultHotelRouteByRole(profile.role));
  }

  return profile.hotel_id;
}

async function loadAreaHotelId(areaId: string) {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("areas")
    .select("id, hotel_id")
    .eq("id", areaId)
    .maybeSingle();

  if (error || !data?.hotel_id) return null;
  return String(data.hotel_id);
}

async function userHasExplicitAreaAccess(userId: string, hotelId: string, areaId: string) {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("user_area_access")
    .select("area_id")
    .eq("user_id", userId)
    .eq("hotel_id", hotelId)
    .eq("area_id", areaId)
    .maybeSingle();

  if (error) return false;
  return Boolean(data?.area_id);
}

export function resolveRouteHotelScope(
  profile: Profile,
  requestedHotelId?: string | null
): ScopedHotelResult {
  if (profile.role === "superadmin") {
    const hotelId = requestedHotelId ?? null;
    if (!hotelId) {
      return { ok: false, error: "Falta hotel_id para superadmin.", status: 400 };
    }

    return { ok: true, hotelId };
  }

  if (!profile.hotel_id) {
    return { ok: false, error: "hotel_id faltante en perfil.", status: 400 };
  }

  if (requestedHotelId && requestedHotelId !== profile.hotel_id) {
    return { ok: false, error: "Forbidden: hotel fuera de alcance.", status: 403 };
  }

  return { ok: true, hotelId: profile.hotel_id };
}

export async function getAllowedAreaIdsForProfile(profile: Profile, hotelId: string) {
  if (profile.role !== "manager") {
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("areas")
      .select("id")
      .eq("hotel_id", hotelId)
      .eq("active", true);

    if (error) throw error;
    return (data ?? []).map((row) => String(row.id));
  }

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("user_area_access")
    .select("area_id")
    .eq("hotel_id", hotelId)
    .eq("user_id", profile.id);

  if (error) throw error;
  return Array.from(new Set((data ?? []).map((row) => String(row.area_id ?? "")).filter(Boolean)));
}

export async function hasAreaScopeForProfile(
  profile: Profile,
  hotelId: string,
  areaId: string
) {
  const elevatedRoles: Role[] = ["superadmin", "admin", "general_manager", "quality"];

  if (elevatedRoles.includes(profile.role)) {
    const scopedHotel = resolveRouteHotelScope(profile, hotelId);
    return scopedHotel.ok;
  }

  if (profile.role === "manager" || profile.role === "auditor") {
    const scopedHotel = resolveRouteHotelScope(profile, hotelId);
    if (!scopedHotel.ok) return false;
    return userHasExplicitAreaAccess(profile.id, scopedHotel.hotelId, areaId);
  }

  return false;
}

export async function requireHotelScope(
  requestedHotelId?: string | null,
  options?: { nextPath?: string; redirectTo?: string; permission?: Permission }
) {
  const auth = options?.permission
    ? await requirePermission(options.permission, options)
    : await requireAuthenticatedUser(options?.nextPath);

  const hotelId = resolveScopedHotelId(auth.profile, requestedHotelId);
  return { ...auth, hotelId };
}

export async function requireAreaScope(
  areaId: string,
  options?: {
    nextPath?: string;
    redirectTo?: string;
    module?: AuthorizationModule;
    permission?: Permission;
  }
) {
  const auth = options?.module
    ? await requireModuleAccess(options.module, options)
    : options?.permission
    ? await requirePermission(options.permission, options)
    : await requireAuthenticatedUser(options?.nextPath);

  const areaHotelId = await loadAreaHotelId(areaId);
  if (!areaHotelId) redirect(options?.redirectTo ?? "/areas");

  const scopedHotelId = resolveScopedHotelId(auth.profile, areaHotelId);
  const elevatedRoles: Role[] = ["superadmin", "admin", "general_manager", "quality"];

  if (elevatedRoles.includes(auth.profile.role)) {
    return { ...auth, hotelId: scopedHotelId, areaId };
  }

  if (auth.profile.role === "manager" || auth.profile.role === "auditor") {
    const hasAccess = await userHasExplicitAreaAccess(auth.profile.id, scopedHotelId, areaId);
    if (!hasAccess) redirect(options?.redirectTo ?? "/areas");
    return { ...auth, hotelId: scopedHotelId, areaId };
  }

  redirect(options?.redirectTo ?? getDefaultHotelRouteByRole(auth.profile.role));
}

export async function requireAuditRunScope(
  runId: string,
  options?: { nextPath?: string; redirectTo?: string; module?: AuthorizationModule }
) {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("audit_runs")
    .select("id, area_id")
    .eq("id", runId)
    .maybeSingle();

  if (error || !data?.area_id) redirect(options?.redirectTo ?? "/areas");

  return requireAreaScope(String(data.area_id), options);
}

export async function authorizeRouteRequest(
  request: NextRequest,
  options?: { roles?: readonly Role[]; permission?: Permission }
): Promise<RequestAuthContext | null> {
  const token = getBearerTokenFromRequest(request);
  if (!token) return null;

  const profile = await loadProfileWithToken(token);
  if (!profile) return null;

  if (options?.roles && !options.roles.includes(profile.role)) return null;
  if (options?.permission && !hasPermission(profile.role, options.permission)) return null;

  return {
    token,
    profile,
    requestedHotelId: request.nextUrl.searchParams.get("hotel_id")?.trim() || null,
  };
}

export function getAllowedRolesForModule(module: AuthorizationModule) {
  return getModuleRoles(module);
}
