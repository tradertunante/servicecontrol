import { NextRequest, NextResponse } from "next/server";

import { authorizeRouteRequest, resolveRouteHotelScope } from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { jsonError, jsonDbError } from "@/lib/api/response";

export async function PATCH(request: NextRequest) {
  const caller = await authorizeRouteRequest(request, {
    roles: ["superadmin", "admin", "general_manager", "manager", "quality"],
  });
  if (!caller) return jsonError("No autorizado.", 401);

  const hotelResult = await resolveRouteHotelScope(caller.profile, null);
  if (!hotelResult.ok) return jsonError(hotelResult.error, hotelResult.status);

  const body = await request.json().catch(() => null);
  const actionId = String(body?.action_id ?? "").trim();
  if (!actionId) return jsonError("action_id es obligatorio.");

  // Build update patch — only accepted fields
  const patch: Record<string, unknown> = {};

  if ("due_date" in body) {
    const raw = body.due_date;
    patch.due_date = raw === null || raw === "" ? null : String(raw);
  }

  if ("assigned_to" in body) {
    const raw = body.assigned_to;
    patch.assigned_to = raw === null || raw === "" ? null : String(raw);
  }

  if (Object.keys(patch).length === 0) {
    return jsonError("Nada que actualizar. Pasa due_date o assigned_to.");
  }

  const admin = supabaseAdmin();

  // Verify the action belongs to this hotel before updating
  const { data: existing, error: fetchErr } = await admin
    .from("audit_corrective_actions")
    .select("id,hotel_id")
    .eq("id", actionId)
    .eq("hotel_id", hotelResult.hotelId)
    .single();

  if (fetchErr || !existing) return jsonError("Acción correctiva no encontrada.", 404);

  const { error: updateErr } = await admin
    .from("audit_corrective_actions")
    .update(patch)
    .eq("id", actionId);

  if (updateErr) return jsonDbError(updateErr);

  return NextResponse.json({ ok: true });
}