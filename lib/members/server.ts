import "server-only";

import type { NextRequest } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  authorizeRouteRequest,
  getAllowedAreaIdsForProfile,
  resolveRouteHotelScope,
} from "@/lib/auth/server";
import type { Role } from "@/lib/auth/permissions";

export type MemberRole = Extract<
  Role,
  "manager" | "quality" | "general_manager" | "admin" | "superadmin"
>;

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

export function uniqueStrings(values: unknown[]) {
  return Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)));
}

export async function getMembersCaller(request: NextRequest) {
  const caller = await authorizeRouteRequest(request, {
    roles: ["manager", "quality", "general_manager", "admin", "superadmin"],
  });

  if (!caller) {
    return { ok: false as const, error: "No autorizado.", status: 401 };
  }

  const hotelResult = resolveRouteHotelScope(caller.profile, null);
  if (!hotelResult.ok) {
    return hotelResult;
  }

  return {
    ok: true as const,
    caller: {
      id: caller.profile.id,
      hotel_id: hotelResult.hotelId,
      role: caller.profile.role as MemberRole,
    } satisfies MemberCaller,
  };
}

export function resolveMembersHotelId(caller: MemberCaller) {
  return resolveRouteHotelScope(caller, null);
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
  const hotelAreaIdSet = new Set(hotelAreaIds);
  const allowedAreaIds = await getAllowedAreaIdsForProfile(caller, hotelId);
  return allowedAreaIds.filter((areaId) => hotelAreaIdSet.has(areaId));
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
