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

  if (error) throw error;

  return data ? String(data.id) : null;
}

async function getHotelAreas(admin: ReturnType<typeof supabaseAdmin>, hotelId: string) {
  const { data: areas, error } = await admin
    .from("areas")
    .select("id, active, hotel_id")
    .eq("hotel_id", hotelId);

  if (error) throw error;

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

  if (error) throw error;

  const hotelAreaSet = new Set(hotelAreaIds);
  return uniqueStrings((rows ?? []).map((row) => row.area_id)).filter((areaId) => hotelAreaSet.has(areaId));
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const callerResult = await getCaller(request);
    if (!callerResult.ok) return jsonError(callerResult.error, callerResult.status);

    const body = await request.json().catch(() => null);
    const requestedHotelId = String(body?.hotel_id ?? "").trim() || null;
    const hotelResult = resolveHotelId(callerResult.caller, requestedHotelId);
    if (!hotelResult.ok) return jsonError(hotelResult.error, hotelResult.status);

    const memberId = String(params.id ?? "").trim();
    const fullName = String(body?.full_name ?? "").trim();
    const employeeNumber = String(body?.employee_number ?? "").trim();
    const active = body?.active !== false;
    const requestedAreaIds = uniqueStrings(Array.isArray(body?.area_ids) ? body.area_ids : []);

    if (!memberId) {
      return jsonError("member_id es obligatorio.");
    }

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
    const { data: member, error: memberError } = await admin
      .from("team_members")
      .select("id, hotel_id")
      .eq("id", memberId)
      .maybeSingle();

    if (memberError) {
      return jsonError(memberError.message, 500);
    }

    if (!member) {
      return jsonError("Miembro no encontrado.", 404);
    }

    if (String(member.hotel_id ?? "") !== hotelResult.hotelId) {
      return jsonError("Forbidden: miembro fuera de tu hotel.", 403);
    }

    const hotelAreas = await getHotelAreas(admin, hotelResult.hotelId);
    const hotelAreaIds = hotelAreas.map((area) => String(area.id));
    const allowedAreaIds = await getAllowedAreaIds(admin, callerResult.caller, hotelResult.hotelId, hotelAreaIds);
    const allowedAreaSet = new Set(allowedAreaIds);

    if (requestedAreaIds.some((areaId) => !allowedAreaSet.has(areaId))) {
      return jsonError("No puedes asignar miembros fuera de tu alcance de areas.", 403);
    }

    if (callerResult.caller.role === "manager") {
      const { data: currentLinks, error: currentLinksError } = await admin
        .from("team_member_areas")
        .select("area_id")
        .eq("team_member_id", memberId)
        .in("area_id", hotelAreaIds);

      if (currentLinksError) {
        return jsonError(currentLinksError.message, 500);
      }

      const currentAreaIds = uniqueStrings((currentLinks ?? []).map((row) => row.area_id));
      const canSeeMember = currentAreaIds.some((areaId) => allowedAreaSet.has(areaId));

      if (!canSeeMember) {
        return jsonError("Forbidden: miembro fuera de tu alcance.", 403);
      }
    }

    const duplicateMemberId = await findDuplicateMemberByEmployeeNumber(
      admin,
      hotelResult.hotelId,
      employeeNumber,
      memberId
    );

    if (duplicateMemberId) {
      return jsonError("El numero de colaborador ya existe en este hotel.", 409);
    }

    const { error: updateError } = await admin
      .from("team_members")
      .update({
        full_name: fullName,
        employee_number: employeeNumber,
        active,
      })
      .eq("id", memberId)
      .eq("hotel_id", hotelResult.hotelId);

    if (updateError) {
      if (updateError.code === "23505") {
        return jsonError("El numero de colaborador ya existe en este hotel.", 409);
      }
      return jsonError(updateError.message, 500);
    }

    const { error: deleteLinksError } = await admin
      .from("team_member_areas")
      .delete()
      .eq("team_member_id", memberId)
      .in("area_id", hotelAreaIds);

    if (deleteLinksError) {
      return jsonError(deleteLinksError.message, 500);
    }

    const linkRows = requestedAreaIds.map((areaId) => ({
      team_member_id: memberId,
      area_id: areaId,
    }));

    const { error: insertLinksError } = await admin.from("team_member_areas").insert(linkRows);

    if (insertLinksError) {
      return jsonError(insertLinksError.message, 500);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Error inesperado.", 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const callerResult = await getCaller(request);
    if (!callerResult.ok) return jsonError(callerResult.error, callerResult.status);

    const body = await request.json().catch(() => null);
    const requestedHotelId = String(body?.hotel_id ?? "").trim() || null;
    const hotelResult = resolveHotelId(callerResult.caller, requestedHotelId);
    if (!hotelResult.ok) return jsonError(hotelResult.error, hotelResult.status);

    const memberId = String(params.id ?? "").trim();

    if (!memberId) {
      return jsonError("member_id es obligatorio.");
    }

    const admin = supabaseAdmin();
    const { data: member, error: memberError } = await admin
      .from("team_members")
      .select("id, hotel_id, active")
      .eq("id", memberId)
      .maybeSingle();

    if (memberError) {
      return jsonError(memberError.message, 500);
    }

    if (!member) {
      return jsonError("Miembro no encontrado.", 404);
    }

    if (String(member.hotel_id ?? "") !== hotelResult.hotelId) {
      return jsonError("Forbidden: miembro fuera de tu hotel.", 403);
    }

    const hotelAreas = await getHotelAreas(admin, hotelResult.hotelId);
    const hotelAreaIds = hotelAreas.map((area) => String(area.id));
    const allowedAreaIds = await getAllowedAreaIds(admin, callerResult.caller, hotelResult.hotelId, hotelAreaIds);

    if (callerResult.caller.role === "manager") {
      const { data: currentLinks, error: currentLinksError } = await admin
        .from("team_member_areas")
        .select("area_id")
        .eq("team_member_id", memberId)
        .in("area_id", hotelAreaIds);

      if (currentLinksError) {
        return jsonError(currentLinksError.message, 500);
      }

      const allowedAreaSet = new Set(allowedAreaIds);
      const currentAreaIds = uniqueStrings((currentLinks ?? []).map((row) => row.area_id));
      const canSeeMember = currentAreaIds.some((areaId) => allowedAreaSet.has(areaId));

      if (!canSeeMember) {
        return jsonError("Forbidden: miembro fuera de tu alcance.", 403);
      }
    }

    if (member.active === false) {
      return NextResponse.json({ ok: true, already_inactive: true });
    }

    const { error: updateError } = await admin
      .from("team_members")
      .update({ active: false })
      .eq("id", memberId)
      .eq("hotel_id", hotelResult.hotelId);

    if (updateError) {
      return jsonError(updateError.message, 500);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Error inesperado.", 500);
  }
}
