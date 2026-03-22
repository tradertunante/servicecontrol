import { NextRequest, NextResponse } from "next/server";

import { canStartAudits } from "@/lib/auth/permissions";
import {
  authorizeRouteRequest,
  hasAreaScopeForProfile,
  resolveRouteHotelScope,
} from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { jsonError, jsonDbError } from "@/lib/api/response";

type StartAuditRpcResponse = {
  ok?: boolean;
  code?: string;
  message?: string;
  data?: {
    run_id?: string;
    seeded_answers?: number;
  } | null;
};

export async function POST(request: NextRequest) {
  const caller = await authorizeRouteRequest(request, {
    roles: ["superadmin", "admin", "general_manager", "manager", "auditor", "quality"],
  });
  if (!caller) return jsonError("No autorizado.", 401);
  if (!canStartAudits(caller.profile.role)) {
    return jsonError("No tienes permisos para iniciar auditorías.", 403);
  }

  const hotelResult = resolveRouteHotelScope(caller.profile, null);
  if (!hotelResult.ok) return jsonError(hotelResult.error, hotelResult.status);

  const body = await request.json().catch(() => null);
  const areaId = String(body?.area_id ?? "").trim();
  const templateId = String(body?.audit_template_id ?? "").trim();
  const roomNumber = typeof body?.room_number === "string" ? body.room_number.trim() || null : null;

  if (!areaId) return jsonError("area_id es obligatorio.");
  if (!templateId) return jsonError("audit_template_id es obligatorio.");

  const hasAreaScope = await hasAreaScopeForProfile(caller.profile, hotelResult.hotelId, areaId);
  if (!hasAreaScope) {
    return jsonError("No tienes acceso a esta área.", 403);
  }

  const admin = supabaseAdmin();
  const [{ data: area, error: areaErr }, { data: template, error: templateErr }] = await Promise.all([
    admin.from("areas").select("id, hotel_id, active").eq("id", areaId).maybeSingle(),
    admin
      .from("audit_templates")
      .select("id, hotel_id, area_id, active")
      .eq("id", templateId)
      .maybeSingle(),
  ]);

  if (areaErr) return jsonDbError(areaErr);
  if (!area?.id || String(area.hotel_id ?? "") !== hotelResult.hotelId || area.active === false) {
    return jsonError("El área no pertenece al hotel activo.", 403);
  }

  if (templateErr) return jsonDbError(templateErr);
  if (
    !template?.id ||
    String(template.hotel_id ?? "") !== hotelResult.hotelId ||
    String(template.area_id ?? "") !== areaId ||
    template.active === false
  ) {
    return jsonError("La plantilla no pertenece al hotel activo o área seleccionada.", 403);
  }

  const channel: "quality" | "internal" =
    caller.profile.role === "quality" ? "quality" : "internal";

  const { data, error } = await admin.rpc("start_audit_run", {
    p_hotel_id: hotelResult.hotelId,
    p_area_id: areaId,
    p_template_id: templateId,
    p_actor_user_id: caller.profile.id,
    p_room_number: roomNumber,
    p_audit_channel: channel,
  });

  if (error) {
    return jsonError(error.message ?? "No se pudo crear la auditoría.", 500);
  }

  const payload = (data ?? null) as StartAuditRpcResponse | null;
  if (!payload?.ok || !payload.data?.run_id) {
    const code = String(payload?.code ?? "");
    const status =
      code === "ACTOR_NOT_FOUND" ? 404
      : code === "AREA_NOT_FOUND" || code === "TEMPLATE_NOT_FOUND" ? 404
      : code === "FORBIDDEN_ROLE" || code === "AREA_OUT_OF_SCOPE" || code === "TEMPLATE_OUT_OF_SCOPE" ? 403
      : code === "ACTOR_INACTIVE" || code === "AREA_INACTIVE" || code === "TEMPLATE_INACTIVE" ? 409
      : code === "INVALID_AUDIT_CHANNEL" ? 400
      : 500;

    return jsonError(payload?.message ?? "No se pudo crear la auditoría.", status);
  }

  return NextResponse.json({
    ok: true,
    run_id: String(payload.data.run_id),
    seeded_answers: Number(payload.data.seeded_answers ?? 0),
  });
}
