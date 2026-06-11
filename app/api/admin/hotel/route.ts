import { NextRequest, NextResponse } from "next/server";
import { authorizeRouteRequest, resolveRouteHotelScope } from "@/lib/auth/server";
import { jsonError, jsonDbError } from "@/lib/api/response";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function PATCH(request: NextRequest) {
  try {
    const caller = await authorizeRouteRequest(request, {
      roles: ["admin", "superadmin", "general_manager"],
    });
    if (!caller) return jsonError("No autorizado.", 401);

    const hotelResult = await resolveRouteHotelScope(caller.profile, null);
    if (!hotelResult.ok) return jsonError(hotelResult.error, 403);

    const body = await request.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.trim() : null;

    if (!name) return jsonError("El nombre es obligatorio.", 400);
    if (name.length > 120) return jsonError("El nombre no puede superar 120 caracteres.", 400);

    const { error } = await supabaseAdmin()
      .from("hotels")
      .update({ name })
      .eq("id", hotelResult.hotelId);

    if (error) return jsonDbError(error, "No se pudo actualizar el hotel.");

    return NextResponse.json({ ok: true, name });
  } catch (error) {
    return jsonDbError(error instanceof Error ? { message: error.message } : null, "Error inesperado.");
  }
}