import { NextRequest, NextResponse } from "next/server";

import { authorizeRouteRequest, resolveRouteHotelScope } from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { jsonError, jsonDbError } from "@/lib/api/response";

export async function POST(request: NextRequest) {
  const caller = await authorizeRouteRequest(request, { roles: ["admin", "superadmin"] });
  if (!caller) return jsonError("No autorizado.", 401);

  const hotelResult = resolveRouteHotelScope(caller.profile, null);
  if (!hotelResult.ok) return jsonError(hotelResult.error, hotelResult.status);

  const body = await request.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const areaId = String(body?.area_id ?? "").trim();

  if (!name) return jsonError("El nombre es obligatorio.");
  if (!areaId) return jsonError("area_id es obligatorio.");

  const admin = supabaseAdmin();
  const { data: area, error: areaErr } = await admin
    .from("areas")
    .select("id")
    .eq("id", areaId)
    .eq("hotel_id", hotelResult.hotelId)
    .maybeSingle();

  if (areaErr) return jsonDbError(areaErr);
  if (!area?.id) return jsonError("El área no pertenece al hotel activo.", 403);

  const { data, error } = await admin
    .from("audit_templates")
    .insert({
      name,
      area_id: areaId,
      hotel_id: hotelResult.hotelId,
      active: true,
      scope: "hotel",
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    return jsonDbError(error, "No se pudo crear la plantilla.");
  }

  return NextResponse.json({ ok: true, template_id: String(data.id) });
}
