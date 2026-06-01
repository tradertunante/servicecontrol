import { NextRequest, NextResponse } from "next/server";

import { authorizeRouteRequest } from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { jsonError, jsonDbError } from "@/lib/api/response";
import { parseUUID, isErrorResponse } from "@/lib/api/validate";
import {
  canManageExistingUser,
  loadManagedUser,
  resolveManagedHotelId,
} from "@/lib/auth/userManagement";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const caller = await authorizeRouteRequest(request, { roles: ["admin", "superadmin"] });
    if (!caller) return jsonError("No autorizado.", 401);

    const userId = parseUUID(params.id, "user_id");
    if (isErrorResponse(userId)) return userId;

    const hotelResult = resolveManagedHotelId(caller.profile);
    if (!hotelResult.ok) return jsonError(hotelResult.error, hotelResult.status);

    const target = await loadManagedUser(userId, hotelResult.hotelId);
    if (!target) return jsonError("Usuario no encontrado.", 404);

    if (!canManageExistingUser(caller.profile.role, target.role)) {
      return jsonError("No puedes administrar este usuario.", 403);
    }

    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("audit_runs")
      .select("id, executed_at, score, status, audit_template_id, area_id, audit_templates(name), areas(name)")
      .eq("executed_by", userId)
      .eq("hotel_id", hotelResult.hotelId)
      .is("archived_at", null)
      .order("executed_at", { ascending: false, nullsFirst: false })
      .limit(10);

    if (error) return jsonDbError(error);

    const runs = (data ?? []).map((r: any) => ({
      id: r.id,
      executed_at: r.executed_at,
      score: r.score,
      status: r.status,
      template_name: (r.audit_templates as any)?.name ?? null,
      area_name: (r.areas as any)?.name ?? null,
    }));

    return NextResponse.json({ ok: true, runs });
  } catch (error) {
    return jsonDbError(
      error instanceof Error ? { message: error.message } : null,
      "Error inesperado."
    );
  }
}