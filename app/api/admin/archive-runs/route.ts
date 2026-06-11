import { NextRequest, NextResponse } from "next/server";

import { authorizeRouteRequest, resolveRouteHotelScope } from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { jsonError, jsonDbError } from "@/lib/api/response";

export async function POST(request: NextRequest) {
  const caller = await authorizeRouteRequest(request, { roles: ["admin", "superadmin"] });
  if (!caller) return jsonError("No autorizado.", 401);

  const hotelResult = await resolveRouteHotelScope(caller.profile, null);
  if (!hotelResult.ok) return jsonError(hotelResult.error, hotelResult.status);

  const body = await request.json().catch(() => null);
  const olderThanDays = typeof body?.older_than_days === "number" ? body.older_than_days : 180;

  if (olderThanDays < 30) {
    return jsonError("No se pueden archivar auditorías de menos de 30 días.", 400);
  }

  const admin = supabaseAdmin();
  const { data, error } = await admin.rpc("archive_old_audit_runs", {
    p_hotel_id: hotelResult.hotelId,
    p_older_than_days: olderThanDays,
  });

  if (error) return jsonDbError(error);

  return NextResponse.json({ ok: true, ...(data as Record<string, unknown>) });
}
