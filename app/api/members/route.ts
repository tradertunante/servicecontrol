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
import { jsonError, jsonDbError } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    const callerResult = await getMembersCaller(request);
    if (!callerResult.ok) return jsonError(callerResult.error, callerResult.status);

    const rawStatus = request.nextUrl.searchParams.get("status")?.trim().toLowerCase() ?? "active";
    const status: "all" | "active" | "inactive" =
      rawStatus === "inactive" ? "inactive" : rawStatus === "all" ? "all" : "active";

    const page = Math.max(1, parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(10, parseInt(request.nextUrl.searchParams.get("page_size") ?? "50", 10) || 50));

    const hotelResult = resolveMembersHotelId(callerResult.caller);
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

    const total = payload.members.length;
    const start = (page - 1) * pageSize;
    const pagedMembers = payload.members.slice(start, start + pageSize);

    return NextResponse.json({
      ok: true,
      members: pagedMembers,
      available_areas: payload.availableAreas,
      hotel_id: hotelResult.hotelId,
      role: callerResult.caller.role,
      pagination: {
        page,
        page_size: pageSize,
        total,
        total_pages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    return jsonDbError(error instanceof Error ? { message: error.message } : null, "Error inesperado.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const callerResult = await getMembersCaller(request);
    if (!callerResult.ok) return jsonError(callerResult.error, callerResult.status);

    const body = await request.json().catch(() => null);
    const hotelResult = resolveMembersHotelId(callerResult.caller);
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
      return jsonDbError(memberError, "No se pudo crear el miembro.");
    }

    const linkRows = requestedAreaIds.map((areaId) => ({
      team_member_id: member.id,
      area_id: areaId,
    }));

    const { error: linkError } = await admin.from("team_member_areas").insert(linkRows);

    if (linkError) {
      return jsonDbError(linkError);
    }

    return NextResponse.json({ ok: true, member_id: member.id });
  } catch (error) {
    return jsonDbError(error instanceof Error ? { message: error.message } : null, "Error inesperado.");
  }
}
