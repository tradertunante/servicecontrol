import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  buildMembersPayload,
  findDuplicateMemberByEmployeeNumber,
  getAllowedAreaIds,
  getHotelAreas,
  getMembersCaller,
  resolveMembersHotelId,
  uniqueStrings,
} from "@/lib/members/server";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const callerResult = await getMembersCaller(request);
    if (!callerResult.ok) return jsonError(callerResult.error, callerResult.status);

    const requestedHotelId = request.nextUrl.searchParams.get("hotel_id")?.trim() ?? null;
    const rawStatus = request.nextUrl.searchParams.get("status")?.trim().toLowerCase() ?? "active";
    const status: "all" | "active" | "inactive" =
      rawStatus === "inactive" ? "inactive" : rawStatus === "all" ? "all" : "active";
    const hotelResult = resolveMembersHotelId(callerResult.caller, requestedHotelId);
    if (!hotelResult.ok) return jsonError(hotelResult.error, hotelResult.status);

    const admin = supabaseAdmin();
    const hotelAreas = await getHotelAreas(admin, hotelResult.hotelId);
    const allowedAreaIds = await getAllowedAreaIds(
      admin,
      callerResult.caller,
      hotelResult.hotelId,
      hotelAreas.map((area) => area.id)
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
    const callerResult = await getMembersCaller(request);
    if (!callerResult.ok) return jsonError(callerResult.error, callerResult.status);

    const body = await request.json().catch(() => null);
    const requestedHotelId = String(body?.hotel_id ?? "").trim() || null;
    const hotelResult = resolveMembersHotelId(callerResult.caller, requestedHotelId);
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
    const hotelAreaIds = hotelAreas.map((area) => area.id);
    const allowedAreaIds = await getAllowedAreaIds(admin, callerResult.caller, hotelResult.hotelId, hotelAreaIds);
    const allowedAreaSet = new Set(allowedAreaIds);

    if (requestedAreaIds.some((areaId) => !allowedAreaSet.has(areaId))) {
      return jsonError("No puedes asignar miembros fuera de tu alcance de areas.", 403);
    }

    const duplicateMember = await findDuplicateMemberByEmployeeNumber(
      admin,
      hotelResult.hotelId,
      employeeNumber
    );

    if (duplicateMember) {
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
