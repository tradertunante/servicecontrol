import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  canSeeMemberWithinScope,
  findDuplicateMemberByEmployeeNumber,
  getAllowedAreaIds,
  getHotelAreas,
  getHotelTemplates,
  getMembersCaller,
  resolveMembersHotelId,
  uniqueStrings,
} from "@/lib/members/server";
import { jsonError, jsonDbError } from "@/lib/api/response";
import { parseUUID, isErrorResponse } from "@/lib/api/validate";
import { logger } from "@/lib/logger";

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

    const memberId = parseUUID(params.id, "id");
    if (isErrorResponse(memberId)) return memberId;

    const fullName = String(body?.full_name ?? "").trim();
    const employeeNumber = String(body?.employee_number ?? "").trim();
    const active = body?.active !== false;
    const requestedAreaIds = uniqueStrings(Array.isArray(body?.area_ids) ? body.area_ids : []);
    const requestedTemplateIds = uniqueStrings(Array.isArray(body?.template_ids) ? body.template_ids : []);

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
      await logger.error("members_member_lookup_error", { error: memberError.message });
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
        await logger.error("members_current_links_error", { error: currentLinksError.message });
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
        await logger.error("members_duplicate_links_error", { error: duplicateLinksError.message });
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
      await logger.error("members_update_error", { error: updateError.message });
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
      await logger.error("members_insert_links_error", { error: insertLinksError.message });
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
        await logger.error("members_delete_stale_links_error", { error: deleteLinksError.message });
        return jsonError("Error interno al limpiar áreas anteriores.", 500);
      }
    }

    // Sync audit template assignments
    const hotelTemplates = await getHotelTemplates(admin, hotelResult.hotelId);
    const hotelTemplateIds = hotelTemplates.map((t) => t.id);
    const validTemplateIds = new Set(hotelTemplateIds);
    const safeRequestedTemplateIds = requestedTemplateIds.filter((tid) => validTemplateIds.has(tid));

    if (safeRequestedTemplateIds.length > 0) {
      const templateLinkRows = safeRequestedTemplateIds.map((tid) => ({
        audit_template_id: tid,
        team_member_id: memberId,
      }));

      const { error: upsertTemplatesError } = await admin
        .from("audit_template_members")
        .upsert(templateLinkRows, { onConflict: "audit_template_id,team_member_id", ignoreDuplicates: true });

      if (upsertTemplatesError) {
        await logger.error("members_upsert_templates_error", { error: upsertTemplatesError.message });
        return jsonError("Error interno al asignar auditorías.", 500);
      }
    }

    // Remove stale template links (templates in hotel but not in new set)
    const safeRequestedTemplateSet = new Set(safeRequestedTemplateIds);
    const staleTemplateIds = hotelTemplateIds.filter((tid) => !safeRequestedTemplateSet.has(tid));

    if (staleTemplateIds.length > 0) {
      const { error: deleteTemplatesError } = await admin
        .from("audit_template_members")
        .delete()
        .eq("team_member_id", memberId)
        .in("audit_template_id", staleTemplateIds);

      if (deleteTemplatesError) {
        await logger.error("members_delete_stale_templates_error", { error: deleteTemplatesError.message });
        return jsonError("Error interno al limpiar auditorías anteriores.", 500);
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

    const memberId = parseUUID(params.id, "id");
    if (isErrorResponse(memberId)) return memberId;

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
