import "server-only";

import type { NextRequest } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabaseWithToken } from "@/lib/supabaseServer";

export type MemberRole = "manager" | "quality" | "general_manager" | "admin" | "superadmin";

export type MemberCaller = {
  id: string;
  hotel_id: string | null;
  role: MemberRole;
};

export type DuplicateMember = {
  id: string;
  full_name: string;
  active: boolean;
} | null;

export type HotelAreaRecord = {
  id: string;
  name: string;
  active: boolean;
  hotel_id: string;
};

function normalizeRole(input: unknown): string {
  return String(input ?? "").trim().toLowerCase();
}

export function uniqueStrings(values: unknown[]) {
  return Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)));
}

export function getBearerToken(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
}

export async function getMembersCaller(request: NextRequest) {
  const token = getBearerToken(request);

  if (!token) {
    return { ok: false as const, error: "No autorizado.", status: 401 };
  }

  const client = supabaseWithToken(token);
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser(token);

  if (authError || !user) {
    return { ok: false as const, error: "No autorizado.", status: 401 };
  }

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("id, hotel_id, role, active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return { ok: false as const, error: "Perfil invalido.", status: 403 };
  }

  const role = normalizeRole(profile.role);
  const active = profile.active ?? true;
  const allowedRoles: MemberRole[] = ["manager", "quality", "general_manager", "admin", "superadmin"];

  if (!active || !allowedRoles.includes(role as MemberRole)) {
    return { ok: false as const, error: "Forbidden.", status: 403 };
  }

  return {
    ok: true as const,
    caller: {
      id: String(profile.id),
      hotel_id: (profile.hotel_id as string | null) ?? null,
      role: role as MemberRole,
    } satisfies MemberCaller,
  };
}

export function resolveMembersHotelId(caller: MemberCaller, requestedHotelId: string | null) {
  if (caller.role === "superadmin") {
    if (!requestedHotelId) {
      return { ok: false as const, error: "Falta hotel_id para superadmin.", status: 400 };
    }

    return { ok: true as const, hotelId: requestedHotelId };
  }

  if (!caller.hotel_id) {
    return { ok: false as const, error: "hotel_id faltante en perfil.", status: 400 };
  }

  if (requestedHotelId && requestedHotelId !== caller.hotel_id) {
    return { ok: false as const, error: "Forbidden: hotel incorrecto.", status: 403 };
  }

  return { ok: true as const, hotelId: caller.hotel_id };
}

export async function getHotelAreas(admin: ReturnType<typeof supabaseAdmin>, hotelId: string) {
  const { data: areas, error } = await admin
    .from("areas")
    .select("id, name, active, hotel_id")
    .eq("hotel_id", hotelId)
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return (areas ?? [])
    .filter((area) => area.active !== false)
    .map((area) => ({
      id: String(area.id),
      name: String(area.name ?? "Área"),
      active: area.active ?? true,
      hotel_id: String(area.hotel_id ?? hotelId),
    })) satisfies HotelAreaRecord[];
}

export async function getAllowedAreaIds(
  admin: ReturnType<typeof supabaseAdmin>,
  caller: MemberCaller,
  hotelId: string,
  hotelAreaIds: string[]
) {
  if (caller.role !== "manager") {
    return hotelAreaIds;
  }

  const { data: rows, error } = await admin
    .from("user_area_access")
    .select("area_id")
    .eq("hotel_id", hotelId)
    .eq("user_id", caller.id);

  if (error) {
    throw error;
  }

  const hotelAreaIdSet = new Set(hotelAreaIds);
  return uniqueStrings((rows ?? []).map((row) => row.area_id)).filter((areaId) => hotelAreaIdSet.has(areaId));
}

export async function findDuplicateMemberByEmployeeNumber(
  admin: ReturnType<typeof supabaseAdmin>,
  hotelId: string,
  employeeNumber: string,
  excludeMemberId?: string
) {
  let query = admin
    .from("team_members")
    .select("id, full_name, active")
    .eq("hotel_id", hotelId)
    .eq("employee_number", employeeNumber)
    .limit(1);

  if (excludeMemberId) {
    query = query.neq("id", excludeMemberId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw error;
  }

  return data
    ? {
        id: String(data.id),
        full_name: String(data.full_name ?? ""),
        active: data.active ?? true,
      }
    : null satisfies DuplicateMember;
}

export function canSeeMemberWithinScope(role: MemberRole, allowedAreaSet: Set<string>, memberAreaIds: string[]) {
  if (role !== "manager") {
    return true;
  }

  return memberAreaIds.some((areaId) => allowedAreaSet.has(areaId));
}

export async function buildMembersPayload(
  admin: ReturnType<typeof supabaseAdmin>,
  hotelId: string,
  allowedAreaIds: string[],
  managerScoped: boolean,
  status: "all" | "active" | "inactive"
) {
  const hotelAreas = await getHotelAreas(admin, hotelId);
  const hotelAreaIds = hotelAreas.map((area) => area.id);
  const areaNameById = new Map<string, string>(hotelAreas.map((area) => [area.id, area.name]));

  let membersQuery = admin
    .from("team_members")
    .select("id, full_name, employee_number, active, hotel_id")
    .eq("hotel_id", hotelId);

  if (status === "active") {
    membersQuery = membersQuery.eq("active", true);
  } else if (status === "inactive") {
    membersQuery = membersQuery.eq("active", false);
  }

  const { data: members, error: membersError } = await membersQuery.order("full_name", { ascending: true });

  if (membersError) {
    throw membersError;
  }

  const { data: links, error: linksError } = hotelAreaIds.length
    ? await admin
        .from("team_member_areas")
        .select("team_member_id, area_id")
        .in("area_id", hotelAreaIds)
    : { data: [], error: null };

  if (linksError) {
    throw linksError;
  }

  const memberAreaIds = new Map<string, string[]>();

  for (const link of links ?? []) {
    const memberId = String(link.team_member_id ?? "");
    const areaId = String(link.area_id ?? "");
    if (!memberId || !areaId) continue;
    const current = memberAreaIds.get(memberId) ?? [];
    current.push(areaId);
    memberAreaIds.set(memberId, uniqueStrings(current));
  }

  const allowedAreaSet = new Set(allowedAreaIds);

  const visibleMembers = (members ?? []).filter((member) => {
    if (!managerScoped) return true;
    const assigned = memberAreaIds.get(String(member.id)) ?? [];
    return assigned.some((areaId) => allowedAreaSet.has(areaId));
  });

  const availableAreas = hotelAreas
    .filter((area) => !managerScoped || allowedAreaSet.has(area.id))
    .map((area) => ({
      id: area.id,
      name: area.name,
    }));

  return {
    members: visibleMembers.map((member) => {
      const areaIds = memberAreaIds.get(String(member.id)) ?? [];
      return {
        id: String(member.id),
        full_name: String(member.full_name ?? ""),
        employee_number: member.employee_number == null ? null : String(member.employee_number),
        active: member.active ?? true,
        hotel_id: String(member.hotel_id ?? hotelId),
        area_ids: areaIds,
        area_names: areaIds.map((areaId) => areaNameById.get(areaId) ?? areaId),
      };
    }),
    availableAreas,
    hotelAreas,
    hotelAreaIds,
    memberAreaIds,
  };
}
