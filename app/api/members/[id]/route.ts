import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  canSeeMemberWithinScope,
  findDuplicateMemberByEmployeeNumber,
  getAllowedAreaIds,
  getHotelAreas,
  getMembersCaller,
  resolveMembersHotelId,
  uniqueStrings,
} from "@/lib/members/server";
import { jsonError, jsonDbError } from "@/lib/api/response";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const callerResult = await getMembersCaller(request);
    if (!callerResult.ok) return jsonError(callerResult.error, callerResult.status);

    const body = await request.json().catch(() => null);
    const hotelResult = resolveMembersHotelId(callerResult.caller);
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
      console.error("[members] member lookup error:", memberError.message);
      return jsonError("Error interno al buscar miembro.", 500);
    }

    if (!member) {
      return jsonError("Miembro no encontrado.", 404);
    }

    if (String(member.hotel_id ?? "") !== hotelResult.hotelId) {
      return jsonError("Forbidden: miembro fuera de tu hotel.", 403);
    }

    const hotelAreas = await getHotelAreas(admin, hotelResult.hotelId);
    const hotelAreaIds = hotelAreas.map((area) => area.id);
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
        console.error("[members] current links error:", currentLinksError.message);
        return jsonError("Error interno al verificar áreas.", 500);
      }

      const currentAreaIds = uniqueStrings((currentLinks ?? []).map((row) => row.area_id));
      const canSeeMember = currentAreaIds.some((areaId) => allowedAreaSet.has(areaId));

      if (!canSeeMember) {
        return jsonError("Forbidden: miembro fuera de tu alcance.", 403);
      }
    }

    const duplicateMember = await findDuplicateMemberByEmployeeNumber(
      admin,
      hotelResult.hotelId,
      employeeNumber,
      memberId
    );

    if (duplicateMember) {
      const { data: duplicateLinks, error: duplicateLinksError } = await admin
        .from("team_member_areas")
        .select("area_id")
        .eq("team_member_id", duplicateMember.id)
        .in("area_id", hotelAreaIds);

      if (duplicateLinksError) {
        console.error("[members] duplicate links error:", duplicateLinksError.message);
        return jsonError("Error interno al verificar duplicados.", 500);
      }

      const duplicateAreaIds = uniqueStrings((duplicateLinks ?? []).map((row) => row.area_id));
      const duplicateWithinVisibleScope = canSeeMemberWithinScope(
        callerResult.caller.role,
        allowedAreaSet,
        duplicateAreaIds
      );
      const canRevealDuplicateIdentity = callerResult.caller.role !== "manager";
      const duplicateMessage = canRevealDuplicateIdentity
        ? `El numero de colaborador ya esta asignado a ${duplicateMember.full_name || "otro miembro"} (${duplicateMember.id}) dentro de este hotel.`
        : "El numero de colaborador ya esta asignado a otro miembro de este hotel, posiblemente fuera de tu alcance visible.";
      const debugInfo =
        process.env.NODE_ENV !== "production"
          ? {
              debug: {
                effective_hotel_id: hotelResult.hotelId,
                edited_member_id: memberId,
                requested_employee_number: employeeNumber,
                duplicate_member_id: duplicateMember.id,
                duplicate_member_active: duplicateMember.active,
                duplicate_member_within_visible_scope: duplicateWithinVisibleScope,
              },
            }
          : undefined;

      return NextResponse.json(
        {
          ok: false,
          error: duplicateMessage,
          conflict_member: canRevealDuplicateIdentity
            ? {
                id: duplicateMember.id,
                full_name: duplicateMember.full_name,
                active: duplicateMember.active,
              }
            : null,
          ...(debugInfo ?? {}),
        },
        { status: 409 }
      );
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
      console.error("[members] update error:", updateError.message);
      return jsonError("Error interno al actualizar miembro.", 500);
    }

    // 1. Insert/upsert new area links first (safe: duplicates are ignored)
    const linkRows = requestedAreaIds.map((areaId) => ({
      team_member_id: memberId,
      area_id: areaId,
    }));

    const { error: insertLinksError } = await admin
      .from("team_member_areas")
      .upsert(linkRows, { onConflict: "team_member_id,area_id", ignoreDuplicates: true });

    if (insertLinksError) {
      console.error("[members] insert links error:", insertLinksError.message);
      return jsonError("Error interno al asignar áreas.", 500);
    }

    // 2. Remove only the old area links that are NOT in the new set
    const requestedAreaSet = new Set(requestedAreaIds);
    const staleAreaIds = hotelAreaIds.filter((areaId) => !requestedAreaSet.has(areaId));

    if (staleAreaIds.length > 0) {
      const { error: deleteLinksError } = await admin
        .from("team_member_areas")
        .delete()
        .eq("team_member_id", memberId)
        .in("area_id", staleAreaIds);

      if (deleteLinksError) {
        console.error("[members] delete stale links error:", deleteLinksError.message);
        return jsonError("Error interno al limpiar áreas anteriores.", 500);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonDbError(error instanceof Error ? { message: error.message } : null, "Error inesperado.");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const callerResult = await getMembersCaller(request);
    if (!callerResult.ok) return jsonError(callerResult.error, callerResult.status);

    await request.json().catch(() => null);
    const hotelResult = resolveMembersHotelId(callerResult.caller);
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
      return jsonDbError(memberError);
    }

    if (!member) {
      return jsonError("Miembro no encontrado.", 404);
    }

    if (String(member.hotel_id ?? "") !== hotelResult.hotelId) {
      return jsonError("Forbidden: miembro fuera de tu hotel.", 403);
    }

    const hotelAreas = await getHotelAreas(admin, hotelResult.hotelId);
    const hotelAreaIds = hotelAreas.map((area) => area.id);
    const allowedAreaIds = await getAllowedAreaIds(admin, callerResult.caller, hotelResult.hotelId, hotelAreaIds);

    if (callerResult.caller.role === "manager") {
      const { data: currentLinks, error: currentLinksError } = await admin
        .from("team_member_areas")
        .select("area_id")
        .eq("team_member_id", memberId)
        .in("area_id", hotelAreaIds);

      if (currentLinksError) {
        return jsonDbError(currentLinksError);
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
      return jsonDbError(updateError);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonDbError(error instanceof Error ? { message: error.message } : null, "Error inesperado.");
  }
}
