import { NextRequest, NextResponse } from "next/server";

import { authorizeRouteRequest, resolveRouteHotelScope } from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { jsonError, jsonDbError } from "@/lib/api/response";

type CorrectiveActionStatusRpcResponse = {
  ok?: boolean;
  code?: string;
  message?: string;
};

export async function POST(request: NextRequest) {
  const caller = await authorizeRouteRequest(request, {
    roles: ["superadmin", "admin", "general_manager", "manager", "quality"],
  });
  if (!caller) return jsonError("No autorizado.", 401);

  const hotelResult = await resolveRouteHotelScope(caller.profile, null);
  if (!hotelResult.ok) return jsonError(hotelResult.error, hotelResult.status);

  const body = await request.json().catch(() => null);
  const actionId = String(body?.action_id ?? "").trim();
  const nextStatus = String(body?.status ?? "").trim() as "open" | "in_progress" | "resolved";

  if (!actionId) return jsonError("action_id es obligatorio.");
  if (!["open", "in_progress", "resolved"].includes(nextStatus)) {
    return jsonError("status inválido.");
  }

  const admin = supabaseAdmin();
  const { data, error } = await admin.rpc("update_corrective_action_status_atomic", {
    p_action_id: actionId,
    p_hotel_id: hotelResult.hotelId,
    p_actor_user_id: caller.profile.id,
    p_next_status: nextStatus,
  });

  if (error) return jsonDbError(error);

  const payload = (data ?? null) as CorrectiveActionStatusRpcResponse | null;
  if (!payload?.ok) {
    const code = String(payload?.code ?? "");
    const status =
      code === "ACTION_NOT_FOUND" ? 404
      : code === "FORBIDDEN" ? 403
      : code === "INVALID_STATUS" ? 400
      : 500;
    return jsonError(payload?.message ?? "No se pudo actualizar la acción.", status);
  }

  return NextResponse.json({ ok: true });
}
