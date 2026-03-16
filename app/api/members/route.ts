import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabaseWithToken } from "@/lib/supabaseServer";

type Role = "manager" | "quality" | "general_manager" | "admin" | "superadmin";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function normalizeRole(input: unknown): string {
  return String(input ?? "").trim().toLowerCase();
}

function getBearerToken(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
}

function uniqueStrings(values: unknown[]) {
  return Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)));
}

async function getCaller(request: NextRequest) {
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
  const allowedRoles: Role[] = ["manager", "quality", "general_manager", "admin", "superadmin"];

  if (!active || !allowedRoles.includes(role as Role)) {
    return { ok: false as const, error: "Forbidden.", status: 403 };
  }

  return {
    ok: true as const,
    caller: {
      id: String(profile.id),
      hotel_id: (profile.hotel_id as string | null) ?? null,
      role: role as Role,
    },
  };
}

function resolveHotelId(caller: { hotel_id: string | null; role: Role }, requestedHotelId: string | null) {
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

async function findDuplicateMemberByEmployeeNumber(
  admin: ReturnType<typeof supabaseAdmin>,
  hotelId: string,
  employeeNumber: string,
  excludeMemberId?: string
) {
  let query = admin
    .from("team_members")
    .select("id")
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

  return data ? String(data.id) : null;
}

async function getHotelAreas(admin: ReturnType<typeof supabaseAdmin>, hotelId: string) {
  const { data: areas, error } = await admin
    .from("areas")
    .select("id, name, active, hotel_id")
    .eq("hotel_id", hotelId)
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return (areas ?? []).filter((area) => area.active !== false);
}

async function getAllowedAreaIds(
  admin: ReturnType<typeof supabaseAdmin>,
  caller: { id: string; role: Role },
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

async function buildMembersPayload(
  admin: ReturnType<typeof supabaseAdmin>,
  hotelId: string,
  allowedAreaIds: string[],
  managerScoped: boolean,
  status: "all" | "active" | "inactive"
) {
  const hotelAreas = await getHotelAreas(admin, hotelId);
  const hotelAreaIds = hotelAreas.map((area) => String(area.id));
  const areaNameById = new Map<string, string>(hotelAreas.map((area) => [String(area.id), String(area.name ?? "Área")]));

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
    .filter((area) => !managerScoped || allowedAreaSet.has(String(area.id)))
    .map((area) => ({
      id: String(area.id),
      name: String(area.name ?? "Área"),
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
  };
}

export async function GET(request: NextRequest) {
  try {
    const callerResult = await getCaller(request);
    if (!callerResult.ok) return jsonError(callerResult.error, callerResult.status);

    const requestedHotelId = request.nextUrl.searchParams.get("hotel_id")?.trim() ?? null;
    const rawStatus = request.nextUrl.searchParams.get("status")?.trim().toLowerCase() ?? "active";
    const status: "all" | "active" | "inactive" =
      rawStatus === "inactive" ? "inactive" : rawStatus === "all" ? "all" : "active";
    const hotelResult = resolveHotelId(callerResult.caller, requestedHotelId);
    if (!hotelResult.ok) return jsonError(hotelResult.error, hotelResult.status);

    const admin = supabaseAdmin();
    const hotelAreas = await getHotelAreas(admin, hotelResult.hotelId);
    const allowedAreaIds = await getAllowedAreaIds(
      admin,
      callerResult.caller,
      hotelResult.hotelId,
      hotelAreas.map((area) => String(area.id))
    );

    const payload = await buildMembersPayload(
      admin,
      hotelResult.hotelId,
      allowedAreaIds,
      callerResult.caller.role === "manager",
      status
    );

    return NextResponse.json({
      ok: true,
      members: payload.members,
      available_areas: payload.availableAreas,
      hotel_id: hotelResult.hotelId,
      role: callerResult.caller.role,
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Error inesperado.", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const callerResult = await getCaller(request);
    if (!callerResult.ok) return jsonError(callerResult.error, callerResult.status);

    const body = await request.json().catch(() => null);
    const requestedHotelId = String(body?.hotel_id ?? "").trim() || null;
    const hotelResult = resolveHotelId(callerResult.caller, requestedHotelId);
    if (!hotelResult.ok) return jsonError(hotelResult.error, hotelResult.status);

    const fullName = String(body?.full_name ?? "").trim();
    const employeeNumber = String(body?.employee_number ?? "").trim();
    const active = body?.active !== false;
    const requestedAreaIds = uniqueStrings(Array.isArray(body?.area_ids) ? body.area_ids : []);

    if (!fullName) {
      return jsonError("full_name es obligatorio.");
    }

    if (!employeeNumber) {
      return jsonError("employee_number es obligatorio.");
    }

    if (requestedAreaIds.length === 0) {
      return jsonError("Debes asignar al menos un area.");
    }

    const admin = supabaseAdmin();
    const hotelAreas = await getHotelAreas(admin, hotelResult.hotelId);
    const hotelAreaIds = hotelAreas.map((area) => String(area.id));
    const allowedAreaIds = await getAllowedAreaIds(admin, callerResult.caller, hotelResult.hotelId, hotelAreaIds);
    const allowedAreaSet = new Set(allowedAreaIds);

    if (requestedAreaIds.some((areaId) => !allowedAreaSet.has(areaId))) {
      return jsonError("No puedes asignar miembros fuera de tu alcance de areas.", 403);
    }

    const duplicateMemberId = await findDuplicateMemberByEmployeeNumber(
      admin,
      hotelResult.hotelId,
      employeeNumber
    );

    if (duplicateMemberId) {
      return jsonError("El numero de colaborador ya existe en este hotel.", 409);
    }

    const { data: member, error: memberError } = await admin
      .from("team_members")
      .insert({
        hotel_id: hotelResult.hotelId,
        full_name: fullName,
        employee_number: employeeNumber,
        active,
      })
      .select("id")
      .single();

    if (memberError || !member) {
      if (memberError?.code === "23505") {
        return jsonError("El numero de colaborador ya existe en este hotel.", 409);
      }
      return jsonError(memberError?.message ?? "No se pudo crear el miembro.", 500);
    }

    const linkRows = requestedAreaIds.map((areaId) => ({
      team_member_id: member.id,
      area_id: areaId,
    }));

    const { error: linkError } = await admin.from("team_member_areas").insert(linkRows);

    if (linkError) {
      return jsonError(linkError.message, 500);
    }

    return NextResponse.json({ ok: true, member_id: member.id });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Error inesperado.", 500);
  }
}
