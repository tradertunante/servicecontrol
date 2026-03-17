import { NextRequest, NextResponse } from "next/server";

import { authorizeRouteRequest, resolveRouteHotelScope } from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

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

  if (areaErr) return jsonError(areaErr.message, 500);
  if (!area?.id) return jsonError("El área no pertenece al hotel activo.", 403);

  const { data, error } = await admin
    .from("audit_templates")
    .insert({
      name,
      area_id: areaId,
      hotel_id: hotelResult.hotelId,
      active: true,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    return jsonError(error?.message ?? "No se pudo crear la plantilla.", 500);
  }

  return NextResponse.json({ ok: true, template_id: String(data.id) });
}
