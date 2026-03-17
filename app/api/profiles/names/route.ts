import { NextRequest, NextResponse } from "next/server";

import {
  authorizeRouteRequest,
  hasAreaScopeForProfile,
  resolveRouteHotelScope,
} from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(request: NextRequest) {
  try {
    const caller = await authorizeRouteRequest(request, {
      roles: ["superadmin", "admin", "general_manager", "manager", "auditor", "quality"],
    });
    if (!caller) return jsonError("No autorizado.", 401);

    const body = await request.json().catch(() => null);
    const ids = Array.from(
      new Set(
        (Array.isArray(body?.ids) ? body.ids : [])
          .map((value: unknown) => String(value ?? "").trim())
          .filter(Boolean)
      )
    );
    const areaId = String(body?.area_id ?? "").trim();

    if (!areaId) return jsonError("area_id es obligatorio.", 400);
    if (ids.length === 0) return NextResponse.json({ ok: true, items: [] });

    const hotelResult = resolveRouteHotelScope(caller.profile, null);
    if (!hotelResult.ok) return jsonError(hotelResult.error, hotelResult.status);

    const hasAccess = await hasAreaScopeForProfile(caller.profile, hotelResult.hotelId, areaId);
    if (!hasAccess) return jsonError("Forbidden: area fuera de alcance.", 403);

    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("profiles")
      .select("id, full_name")
      .eq("hotel_id", hotelResult.hotelId)
      .in("id", ids);

    if (error) return jsonError(error.message, 500);

    return NextResponse.json({
      ok: true,
      items: (data ?? []).map((row) => ({
        id: String(row.id),
        full_name: (row.full_name as string | null) ?? null,
      })),
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Error inesperado.", 500);
  }
}
