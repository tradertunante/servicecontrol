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
  const rawAreaIds = Array.isArray(body?.area_ids) ? (body.area_ids as unknown[]) : [];
  const areaIds = Array.from(
    new Set(rawAreaIds.map((value: unknown) => String(value ?? "").trim()).filter(Boolean))
  );

  if (areaIds.length === 0) return jsonError("Debes enviar al menos un area_id.");

  const admin = supabaseAdmin();
  const { data: areas, error: areasErr } = await admin
    .from("areas")
    .select("id")
    .eq("hotel_id", hotelResult.hotelId)
    .in("id", areaIds);

  if (areasErr) return jsonError(areasErr.message, 500);

  const allowedIds = new Set((areas ?? []).map((row) => String(row.id)));
  if (areaIds.some((areaId) => !allowedIds.has(areaId))) {
    return jsonError("Hay áreas fuera del hotel activo.", 403);
  }

  for (const [index, areaId] of areaIds.entries()) {
    const { error } = await admin
      .from("areas")
      .update({ sort_order: index + 1 })
      .eq("id", areaId)
      .eq("hotel_id", hotelResult.hotelId);

    if (error) return jsonError(error.message, 500);
  }

  return NextResponse.json({ ok: true, count: areaIds.length });
}
