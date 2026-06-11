import { NextRequest, NextResponse } from "next/server";

import { authorizeRouteRequest, resolveRouteHotelScope } from "@/lib/auth/server";
import { jsonError, jsonDbError } from "@/lib/api/response";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: NextRequest) {
  try {
    const caller = await authorizeRouteRequest(request, {
      roles: ["mystery_shopper", "admin", "superadmin"],
    });
    if (!caller) return jsonError("No autorizado.", 401);

    const hotelResult = await resolveRouteHotelScope(caller.profile, null);
    if (!hotelResult.ok) return jsonError(hotelResult.error, hotelResult.status);

    const body = await request.json().catch(() => null);
    const runId = String(body?.run_id ?? "").trim();
    if (!runId) return jsonError("run_id es obligatorio.", 400);

    const admin = supabaseAdmin();

    const { data: run, error: runErr } = await admin
      .from("audit_runs")
      .select("id, status, executed_by, hotel_id")
      .eq("id", runId)
      .eq("hotel_id", hotelResult.hotelId)
      .maybeSingle();

    if (runErr) return jsonDbError(runErr);
    if (!run) return jsonError("Auditoría no encontrada.", 404);
    if (run.status !== "submitted") return jsonError("Solo se pueden reabrir auditorías enviadas.", 400);

    if (caller.profile.role === "mystery_shopper") {
      if (run.executed_by !== caller.profile.id) {
        return jsonError("No puedes editar auditorías de otro shopper.", 403);
      }

      const { data: profile } = await admin
        .from("profiles")
        .select("access_expires_at")
        .eq("id", caller.profile.id)
        .maybeSingle();

      if (profile?.access_expires_at && new Date(profile.access_expires_at) < new Date()) {
        return jsonError("Tu período de auditoría ha finalizado.", 403);
      }
    }

    // Delete corrective actions generated from this run
    await admin
      .from("audit_corrective_actions")
      .delete()
      .eq("audit_run_id", runId);

    // Delete auto-generated reaudit runs triggered by this run
    await admin
      .from("audit_runs")
      .delete()
      .eq("parent_audit_run_id", runId)
      .eq("is_reaudit", true);

    // Reset to draft
    const { error: updateErr } = await admin
      .from("audit_runs")
      .update({ status: "draft", score: null })
      .eq("id", runId);

    if (updateErr) return jsonDbError(updateErr);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonDbError(error instanceof Error ? { message: error.message } : null, "Error inesperado.");
  }
}