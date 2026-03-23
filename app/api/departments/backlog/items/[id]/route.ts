import { NextRequest, NextResponse } from "next/server";

import {
  getDepartmentRouteScope,
  normalizeDepartmentCode,
} from "@/app/(app)/_lib/departmentAccess";
import {
  authorizeRouteRequest,
  hasAreaScopeForProfile,
  resolveRouteHotelScope,
} from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { jsonError, jsonDbError } from "@/lib/api/response";

type BacklogItemRow = {
  id: string;
  hotel_id: string | null;
  area_id: string | null;
  owner_department: string | null;
};

type ProfileDepartmentRow = {
  assigned_department_id: string | null;
};

type HotelDepartmentRow = {
  code: string | null;
};

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const caller = await authorizeRouteRequest(request, {
    roles: ["superadmin", "admin", "general_manager", "manager", "quality", "engineering", "it", "systems"],
  });
  if (!caller) return jsonError("No autorizado.", 401);

  const hotelResult = resolveRouteHotelScope(caller.profile, caller.requestedHotelId);
  if (!hotelResult.ok) return jsonError(hotelResult.error, hotelResult.status);

  const params = await context.params;
  const itemId = String(params?.id ?? "").trim();
  if (!itemId) return jsonError("id es obligatorio.");

  const body = await request.json().catch(() => null);
  const nextStatus = String(body?.status ?? "").trim();
  const resolutionComment =
    body?.resolution_comment == null ? null : String(body.resolution_comment).trim() || null;
  const readyForReaudit =
    body?.ready_for_reaudit === undefined ? undefined : body.ready_for_reaudit === true;

  if (!["open", "in_progress", "resolved"].includes(nextStatus)) {
    return jsonError("status inválido.");
  }

  const admin = supabaseAdmin();
  const { data: itemData, error: itemError } = await admin
    .from("department_backlog_items")
    .select("id, hotel_id, area_id, owner_department")
    .eq("id", itemId)
    .maybeSingle();

  if (itemError) return jsonDbError(itemError);
  if (!(itemData as BacklogItemRow | null)?.id) return jsonError("Hallazgo no encontrado.", 404);

  const item = itemData as BacklogItemRow;
  if (String(item.hotel_id ?? "") !== hotelResult.hotelId) {
    return jsonError("El hallazgo no pertenece al hotel activo.", 403);
  }

  const { data: profileData, error: profileError } = await admin
    .from("profiles")
    .select("assigned_department_id")
    .eq("id", caller.profile.id)
    .maybeSingle();

  if (profileError) return jsonDbError(profileError);

  const assignedDepartmentId =
    String((profileData as ProfileDepartmentRow | null)?.assigned_department_id ?? "").trim() || null;

  let assignedDepartmentCode: string | null = null;
  if (assignedDepartmentId) {
    const { data: departmentData, error: departmentError } = await admin
      .from("hotel_departments")
      .select("code")
      .eq("id", assignedDepartmentId)
      .maybeSingle();

    if (departmentError) return jsonDbError(departmentError);
    assignedDepartmentCode = normalizeDepartmentCode(
      (departmentData as HotelDepartmentRow | null)?.code ?? null,
    );
  }

  const hasScopedAreaAccess = item.area_id
    ? await hasAreaScopeForProfile(caller.profile, hotelResult.hotelId, String(item.area_id))
    : false;

  const routeScope = getDepartmentRouteScope(
    normalizeDepartmentCode(item.owner_department) ?? "engineering",
    caller.profile.role,
    assignedDepartmentCode,
    hasScopedAreaAccess,
  );

  if (routeScope === "none") {
    return jsonError("No tienes acceso a este hallazgo.", 403);
  }

  if (routeScope === "area" && !hasScopedAreaAccess) {
    return jsonError("No tienes acceso al área de este hallazgo.", 403);
  }

  const updates: Record<string, unknown> = {
    status: nextStatus,
    resolution_comment: resolutionComment,
    updated_at: new Date().toISOString(),
  };

  if (readyForReaudit !== undefined) {
    updates.ready_for_reaudit = readyForReaudit;
  }

  const { data: updated, error: updateError } = await admin
    .from("department_backlog_items")
    .update(updates)
    .eq("id", itemId)
    .select(
      "id,audit_run_id,question_id,owner_department,title,status,resolution_comment,ready_for_reaudit,hotel_id,area_id,created_at,updated_at",
    )
    .single();

  if (updateError || !updated) {
    return jsonDbError(updateError, "No se pudo actualizar el hallazgo.");
  }

  return NextResponse.json({ ok: true, item: updated });
}
