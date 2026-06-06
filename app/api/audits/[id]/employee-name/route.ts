import { NextRequest, NextResponse } from "next/server";

import { authorizeAuditRunAccess } from "@/lib/audits/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { jsonError, jsonDbError } from "@/lib/api/response";
import { parseUUID, isErrorResponse } from "@/lib/api/validate";

const ALLOWED_ROLES = ["superadmin", "admin", "quality"] as const;

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const params = await context.params;
  const runId = parseUUID(params?.id, "id");
  if (isErrorResponse(runId)) return runId;

  const access = await authorizeAuditRunAccess(request, runId, {
    roles: ALLOWED_ROLES,
  });
  if (!access.ok) return jsonError(access.error, access.status);

  const body = await request.json().catch(() => null);
  const raw = body?.employee_name;
  if (raw === undefined) return jsonError("Falta el campo employee_name.");

  const newName = raw === null ? null : String(raw).trim() || null;

  const admin = supabaseAdmin();

  const { data: current, error: fetchErr } = await admin
    .from("audit_runs")
    .select("employee_name")
    .eq("id", runId)
    .single();

  if (fetchErr || !current) return jsonDbError(fetchErr, "Error al obtener la auditoría.");

  const oldName = (current as any).employee_name ?? null;

  if (oldName === newName) {
    return NextResponse.json({ ok: true, employee_name: newName });
  }

  const { error: updateErr } = await admin
    .from("audit_runs")
    .update({ employee_name: newName })
    .eq("id", runId);

  if (updateErr) return jsonDbError(updateErr, "No se pudo actualizar el nombre.");

  await admin.from("admin_audit_log").insert({
    hotel_id: access.hotelId,
    actor_id: access.caller.profile.id,
    actor_name: access.caller.profile.full_name ?? access.caller.profile.id,
    target_id: runId,
    target_name: `audit_run:${runId}`,
    action: "employee_name_changed",
    old_value: oldName,
    new_value: newName,
  });

  return NextResponse.json({ ok: true, employee_name: newName });
}