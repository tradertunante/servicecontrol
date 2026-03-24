import { NextRequest, NextResponse } from "next/server";

import {
  authorizeRouteRequest,
  hasAreaScopeForProfile,
  resolveRouteHotelScope,
} from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { jsonError, jsonDbError } from "@/lib/api/response";
import { parseUUID, isErrorResponse } from "@/lib/api/validate";
import { logger } from "@/lib/logger";

function mapDeleteAuditRunRpcError(message: string) {
  const normalized = String(message ?? "").toUpperCase();

  if (normalized.includes("RUN_NOT_FOUND")) {
    return { status: 404, message: "La auditoría no existe." };
  }

  if (normalized.includes("FORBIDDEN")) {
    return { status: 403, message: "La auditoría no pertenece al hotel activo." };
  }

  if (normalized.includes("HAS_CHILD_REAUDITS")) {
    return {
      status: 409,
      message: "No se puede borrar la auditoría porque tiene re-auditorías relacionadas.",
    };
  }

  return null;
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const caller = await authorizeRouteRequest(request, {
    roles: ["manager", "admin", "superadmin"],
  });
  if (!caller) return jsonError("No autorizado.", 401);

  const hotelResult = resolveRouteHotelScope(caller.profile, null);
  if (!hotelResult.ok) return jsonError(hotelResult.error, hotelResult.status);

  const params = await context.params;
  const runId = parseUUID(params?.id, "id");
  if (isErrorResponse(runId)) return runId;

  const admin = supabaseAdmin();
  const { data: run, error: runErr } = await admin
    .from("audit_runs")
    .select("id, hotel_id, area_id, is_reaudit")
    .eq("id", runId)
    .maybeSingle();

  if (runErr) return jsonDbError(runErr);
  if (!run?.id) {
    return jsonError("La auditoría no existe.", 404);
  }
  if (String(run.hotel_id ?? "") !== hotelResult.hotelId) {
    return jsonError("La auditoría no pertenece al hotel activo.", 403);
  }

  if (caller.profile.role === "manager") {
    const hasAreaScope = await hasAreaScopeForProfile(
      caller.profile,
      hotelResult.hotelId,
      String(run.area_id ?? "")
    );
    if (!hasAreaScope) {
      return jsonError("No tienes acceso a esta área.", 403);
    }
  }

  const { error: deleteRunErr } = await admin.rpc("delete_audit_run_safe", {
    p_run_id: runId,
    p_hotel_id: hotelResult.hotelId,
  });

  if (deleteRunErr) {
    const mapped = mapDeleteAuditRunRpcError(deleteRunErr.message);
    if (mapped) return jsonError(mapped.message, mapped.status);

    logger.error("delete_audit_run_safe_failed", {
      runId,
      hotelId: hotelResult.hotelId,
      error: deleteRunErr.message,
    });
    return jsonError("No se pudo borrar la auditoría.", 500);
  }

  return NextResponse.json({
    ok: true,
    deleted_run_id: runId,
    deleted_reaudit_logs: Boolean(run.is_reaudit),
  });
}
