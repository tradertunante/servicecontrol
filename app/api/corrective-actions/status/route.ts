import { NextRequest, NextResponse } from "next/server";

import { authorizeRouteRequest, resolveRouteHotelScope } from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(request: NextRequest) {
  const caller = await authorizeRouteRequest(request, {
    roles: ["superadmin", "admin", "general_manager", "manager", "quality"],
  });
  if (!caller) return jsonError("No autorizado.", 401);

  const hotelResult = resolveRouteHotelScope(caller.profile, null);
  if (!hotelResult.ok) return jsonError(hotelResult.error, hotelResult.status);

  const body = await request.json().catch(() => null);
  const actionId = String(body?.action_id ?? "").trim();
  const nextStatus = String(body?.status ?? "").trim() as "open" | "in_progress" | "resolved";

  if (!actionId) return jsonError("action_id es obligatorio.");
  if (!["open", "in_progress", "resolved"].includes(nextStatus)) {
    return jsonError("status inválido.");
  }

  const admin = supabaseAdmin();
  const { data: action, error: actionErr } = await admin
    .from("audit_corrective_actions")
    .select("id, hotel_id, reaudit_run_id")
    .eq("id", actionId)
    .maybeSingle();

  if (actionErr) return jsonError(actionErr.message, 500);
  if (!action?.id || String(action.hotel_id ?? "") !== hotelResult.hotelId) {
    return jsonError("La acción no pertenece al hotel activo.", 404);
  }

  const payload =
    nextStatus === "resolved"
      ? {
          status: nextStatus,
          resolved_at: new Date().toISOString(),
          resolved_by: caller.profile.id,
        }
      : {
          status: nextStatus,
          resolved_at: null,
          resolved_by: null,
        };

  const { error: updateErr } = await admin
    .from("audit_corrective_actions")
    .update(payload)
    .eq("id", actionId)
    .eq("hotel_id", hotelResult.hotelId);

  if (updateErr) return jsonError(updateErr.message, 500);

  if (action.reaudit_run_id) {
    const { data: linked, error: linkedErr } = await admin
      .from("audit_corrective_actions")
      .select("status,blocks_reaudit")
      .eq("reaudit_run_id", String(action.reaudit_run_id))
      .eq("hotel_id", hotelResult.hotelId);

    if (linkedErr) return jsonError(linkedErr.message, 500);

    const blockingOpenCount = (linked ?? []).filter(
      (row: { status?: string | null; blocks_reaudit?: boolean | null }) =>
        row.blocks_reaudit === true && row.status !== "resolved"
    ).length;

    const { data: run, error: runErr } = await admin
      .from("audit_runs")
      .select("requires_training,training_confirmed")
      .eq("id", String(action.reaudit_run_id))
      .eq("hotel_id", hotelResult.hotelId)
      .maybeSingle();

    if (runErr) return jsonError(runErr.message, 500);

    const requiresTraining = !!run?.requires_training;
    const trainingConfirmed = !!run?.training_confirmed;
    const readyForReaudit = blockingOpenCount === 0 && (!requiresTraining || trainingConfirmed);
    const runStatus =
      blockingOpenCount > 0
        ? "blocked_by_non_operational"
        : requiresTraining && !trainingConfirmed
          ? "pending_training"
          : "draft";

    const { error: runUpdateErr } = await admin
      .from("audit_runs")
      .update({
        blocking_issue_count: blockingOpenCount,
        ready_for_reaudit: readyForReaudit,
        status: runStatus,
      })
      .eq("id", String(action.reaudit_run_id))
      .eq("hotel_id", hotelResult.hotelId);

    if (runUpdateErr) return jsonError(runUpdateErr.message, 500);
  }

  return NextResponse.json({ ok: true });
}
