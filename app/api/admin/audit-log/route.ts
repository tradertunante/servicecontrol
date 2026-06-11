import { NextRequest, NextResponse } from "next/server";

import { authorizeRouteRequest, resolveRouteHotelScope } from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { jsonError, jsonDbError } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    const caller = await authorizeRouteRequest(request, { roles: ["admin", "superadmin"] });
    if (!caller) return jsonError("No autorizado.", 401);

    const hotelResult = await resolveRouteHotelScope(caller.profile, null);
    if (!hotelResult.ok) return jsonError(hotelResult.error, hotelResult.status);

    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 200);

    const { data, error } = await supabaseAdmin()
      .from("admin_audit_log")
      .select("id, actor_name, target_name, action, old_value, new_value, created_at")
      .eq("hotel_id", hotelResult.hotelId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return jsonDbError(error);

    return NextResponse.json({ ok: true, entries: data ?? [] });
  } catch (error) {
    return jsonDbError(
      error instanceof Error ? { message: error.message } : null,
      "Error inesperado."
    );
  }
}