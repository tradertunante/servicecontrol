import { NextRequest, NextResponse } from "next/server";

import { authorizeRouteRequest } from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { jsonError, jsonDbError } from "@/lib/api/response";
import { parseUUID, isErrorResponse } from "@/lib/api/validate";

/**
 * GET /api/audits/[id]/full
 *
 * Calls the get_audit_run_full RPC to load the entire audit session
 * in a single database round-trip (replaces 8-query waterfall).
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const params = await context.params;
  const runId = parseUUID(params?.id, "id");
  if (isErrorResponse(runId)) return runId;

  const caller = await authorizeRouteRequest(request, {
    roles: ["superadmin", "admin", "general_manager", "manager", "auditor", "quality", "mystery_shopper"],
  });
  if (!caller) return jsonError("No autorizado.", 401);

  const admin = supabaseAdmin();
  // RPC not yet in generated types — cast to bypass until next type generation
  const { data, error } = await (admin.rpc as Function)("get_audit_run_full", {
    p_run_id: runId,
    p_actor_user_id: caller.profile.id,
  });

  if (error) return jsonDbError(error, "Error al cargar la auditoría.");

  const payload = data as { ok: boolean; code?: string; message?: string; data?: unknown };
  if (!payload?.ok) {
    const status = payload?.code === "FORBIDDEN" ? 403 : payload?.code === "RUN_NOT_FOUND" ? 404 : 500;
    return jsonError(payload?.message ?? "Error desconocido.", status);
  }

  return NextResponse.json(payload);
}
