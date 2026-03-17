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

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

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

  if (runErr) return jsonError(runErr.message, 500);
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

    const blockingIssueCount = Number(run.blocking_issue_count ?? 0);
    const nextReady = blockingIssueCount === 0;
    const nextStatus = nextReady ? "draft" : "blocked_by_non_operational";
    const confirmedByName = caller.profile.full_name?.trim() || caller.profile.id || "unknown";
    const confirmedAt = new Date().toISOString();
    const nextNotes = appendNoteBlock(
      String(run.notes ?? ""),
      buildTrainingConfirmationBlock({
        explanation,
        confirmedBy: confirmedByName,
      })
    );

    const { error: updateErr } = await admin
      .from("audit_runs")
      .update({
        training_confirmed: true,
        blocking_issue_count: blockingIssueCount,
        ready_for_reaudit: nextReady,
        status: nextStatus,
        notes: nextNotes,
      })
      .eq("id", runId)
      .eq("hotel_id", hotelResult.hotelId);

    if (updateErr) return jsonError(updateErr.message, 500);

    const { error: logErr } = await admin.from("reaudit_training_logs").insert({
      hotel_id: hotelResult.hotelId,
      reaudit_run_id: runId,
      team_member_id: run.team_member_id ?? null,
      confirmed_by: caller.profile.id,
      confirmed_at: confirmedAt,
      explanation,
    });

    if (logErr) return jsonError(logErr.message, 500);

    return NextResponse.json({
      ok: true,
      status: nextStatus,
      ready_for_reaudit: nextReady,
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

  if (nextAuditorErr) return jsonError(nextAuditorErr.message, 500);
  if (!nextAuditor?.id) {
    return jsonError("El auditor seleccionado no pertenece al hotel activo.", 403);
  }
  if (areaAccessErr) return jsonError(areaAccessErr.message, 500);
  if (!areaAccess?.user_id) {
    return jsonError("El auditor seleccionado no tiene acceso al área de esta re-auditoría.", 403);
  }

  const changedByName = caller.profile.full_name?.trim() || caller.profile.id || "unknown";
  const changedAt = new Date().toISOString();
  const nextNotes = appendNoteBlock(
    String(run.notes ?? ""),
    buildReassignmentBlock({
      previousAuditorId: run.assigned_auditor_id ? String(run.assigned_auditor_id) : null,
      previousAuditorName: null,
      newAuditorId: nextAuditorId,
      newAuditorName: nextAuditor.full_name ?? null,
      changedBy: changedByName,
      reason: note,
      note,
    })
  );

  const { error: updateErr } = await admin
    .from("audit_runs")
    .update({
      assigned_auditor_id: nextAuditorId,
      notes: nextNotes,
    })
    .eq("id", runId)
    .eq("hotel_id", hotelResult.hotelId);

  if (updateErr) return jsonError(updateErr.message, 500);

  const { error: logErr } = await admin.from("reaudit_assignment_logs").insert({
    hotel_id: hotelResult.hotelId,
    reaudit_run_id: runId,
    previous_auditor_id: run.assigned_auditor_id ?? null,
    new_auditor_id: nextAuditorId,
    changed_by: caller.profile.id,
    changed_at: changedAt,
    reason: note || null,
    note: note || null,
  });

  if (logErr) return jsonError(logErr.message, 500);

  return NextResponse.json({ ok: true, assigned_auditor_id: nextAuditorId });
}
