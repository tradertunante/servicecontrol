import { NextRequest, NextResponse } from "next/server";

import {
  authorizeRouteRequest,
  hasAreaScopeForProfile,
  resolveRouteHotelScope,
} from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  appendNoteBlock,
  buildReassignmentBlock,
  buildTrainingConfirmationBlock,
} from "@/app/(app)/team/_lib/reauditUtils";
import { jsonError, jsonDbError } from "@/lib/api/response";

type ReauditActionRpcResponse = {
  ok?: boolean;
  code?: string;
  message?: string;
  data?: {
    status?: string | null;
    ready_for_reaudit?: boolean | null;
    assigned_auditor_id?: string | null;
  } | null;
};

export async function POST(request: NextRequest) {
  const caller = await authorizeRouteRequest(request, {
    roles: ["manager", "quality", "admin", "superadmin"],
  });
  if (!caller) return jsonError("No autorizado.", 401);

  const hotelResult = resolveRouteHotelScope(caller.profile, null);
  if (!hotelResult.ok) return jsonError(hotelResult.error, hotelResult.status);

  const body = await request.json().catch(() => null);
  const action = String(body?.action ?? "").trim();
  const runId = String(body?.run_id ?? "").trim();

  if (!runId) return jsonError("run_id es obligatorio.");
  if (!["confirm_training", "reassign_auditor"].includes(action)) {
    return jsonError("action inválida.");
  }

  const admin = supabaseAdmin();
  const { data: run, error: runErr } = await admin
    .from("audit_runs")
    .select(
      "id,hotel_id,area_id,team_member_id,assigned_auditor_id,status,notes,blocking_issue_count,is_reaudit"
    )
    .eq("id", runId)
    .maybeSingle();

  if (runErr) return jsonDbError(runErr);
  if (!run?.id || String(run.hotel_id ?? "") !== hotelResult.hotelId) {
    return jsonError("La re-auditoría no pertenece al hotel activo.", 404);
  }
  if (!run.is_reaudit) {
    return jsonError("El run indicado no es una re-auditoría.", 400);
  }

  const hasAreaScope = await hasAreaScopeForProfile(
    caller.profile,
    hotelResult.hotelId,
    String(run.area_id ?? "")
  );
  if (!hasAreaScope) return jsonError("No tienes acceso a esta área.", 403);

  if (action === "confirm_training") {
    const explanation = String(body?.explanation ?? "").trim();
    if (!explanation) {
      return jsonError(
        "Debes explicar qué formación o medida correctiva se realizó antes de confirmar el training."
      );
    }
    if (explanation.length < 12) {
      return jsonError(
        "La explicación es demasiado corta. Añade suficiente detalle para futura trazabilidad."
      );
    }

    const confirmedByName = caller.profile.full_name?.trim() || caller.profile.id || "unknown";
    const noteBlock = buildTrainingConfirmationBlock({
      explanation,
      confirmedBy: confirmedByName,
    });

    const { data, error } = await admin.rpc("process_reaudit_action", {
      p_action: action,
      p_hotel_id: hotelResult.hotelId,
      p_run_id: runId,
      p_actor_user_id: caller.profile.id,
      p_note_block: noteBlock,
      p_explanation: explanation,
      p_next_auditor_id: undefined,
    });

    if (error) return jsonDbError(error);

    const payload = (data ?? null) as ReauditActionRpcResponse | null;
    if (!payload?.ok) {
      const code = String(payload?.code ?? "");
      const status =
        code === "RUN_NOT_FOUND" ? 404
        : code === "FORBIDDEN" ? 403
        : code === "NOT_REAUDIT" ? 400
        : code === "MISSING_EXPLANATION" || code === "EXPLANATION_TOO_SHORT" || code === "INVALID_ACTION" ? 400
        : code === "ACTOR_INVALID" ? 403
        : 500;
      return jsonError(payload?.message ?? "No se pudo procesar la acción.", status);
    }

    return NextResponse.json({
      ok: true,
      status: payload.data?.status ?? null,
      ready_for_reaudit: payload.data?.ready_for_reaudit ?? false,
    });
  }

  const nextAuditorId = String(body?.next_auditor_id ?? "").trim();
  const note = String(body?.note ?? "").trim();

  if (!nextAuditorId) {
    return jsonError("Debes seleccionar un auditor para reasignar la re-auditoría.");
  }
  if (nextAuditorId === String(run.assigned_auditor_id ?? "")) {
    return jsonError("Selecciona un auditor diferente al actual.");
  }
  if (run.status === "submitted") {
    return jsonError("No se puede reasignar una re-auditoría ya cerrada.");
  }

  const [{ data: nextAuditor, error: nextAuditorErr }, { data: areaAccess, error: areaAccessErr }] =
    await Promise.all([
      admin
        .from("profiles")
        .select("id, full_name, hotel_id, active")
        .eq("id", nextAuditorId)
        .eq("hotel_id", hotelResult.hotelId)
        .eq("active", true)
        .maybeSingle(),
      admin
        .from("user_area_access")
        .select("user_id")
        .eq("hotel_id", hotelResult.hotelId)
        .eq("area_id", String(run.area_id ?? ""))
        .eq("user_id", nextAuditorId)
        .maybeSingle(),
    ]);

  if (nextAuditorErr) return jsonDbError(nextAuditorErr);
  if (!nextAuditor?.id) {
    return jsonError("El auditor seleccionado no pertenece al hotel activo.", 403);
  }
  if (areaAccessErr) return jsonDbError(areaAccessErr);
  if (!areaAccess?.user_id) {
    return jsonError("El auditor seleccionado no tiene acceso al área de esta re-auditoría.", 403);
  }

  const changedByName = caller.profile.full_name?.trim() || caller.profile.id || "unknown";
  const noteBlock = buildReassignmentBlock({
    previousAuditorId: run.assigned_auditor_id ? String(run.assigned_auditor_id) : null,
    previousAuditorName: null,
    newAuditorId: nextAuditorId,
    newAuditorName: nextAuditor.full_name ?? null,
    changedBy: changedByName,
    reason: note,
    note,
  });

  const { data, error } = await admin.rpc("process_reaudit_action", {
    p_action: action,
    p_hotel_id: hotelResult.hotelId,
    p_run_id: runId,
    p_actor_user_id: caller.profile.id,
    p_note_block: noteBlock,
    p_explanation: note || undefined,
    p_next_auditor_id: nextAuditorId,
  });

  if (error) return jsonDbError(error);

  const payload = (data ?? null) as ReauditActionRpcResponse | null;
  if (!payload?.ok) {
    const code = String(payload?.code ?? "");
    const status =
      code === "RUN_NOT_FOUND" ? 404
      : code === "FORBIDDEN" || code === "AUDITOR_OUT_OF_SCOPE" || code === "AUDITOR_NO_AREA_ACCESS" ? 403
      : code === "NOT_REAUDIT" || code === "MISSING_AUDITOR" || code === "SAME_AUDITOR" || code === "RUN_ALREADY_SUBMITTED" || code === "INVALID_ACTION" ? 400
      : code === "ACTOR_INVALID" ? 403
      : 500;
    return jsonError(payload?.message ?? "No se pudo procesar la acción.", status);
  }

  return NextResponse.json({
    ok: true,
    assigned_auditor_id: payload.data?.assigned_auditor_id ?? nextAuditorId,
  });
}
