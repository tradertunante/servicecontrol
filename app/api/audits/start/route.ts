import { NextRequest, NextResponse } from "next/server";

import { authorizeRouteRequest, resolveRouteHotelScope } from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(request: NextRequest) {
  const caller = await authorizeRouteRequest(request, {
    roles: ["superadmin", "admin", "general_manager", "manager", "auditor", "quality"],
  });
  if (!caller) return jsonError("No autorizado.", 401);

  const hotelResult = resolveRouteHotelScope(caller.profile, null);
  if (!hotelResult.ok) return jsonError(hotelResult.error, hotelResult.status);

  const body = await request.json().catch(() => null);
  const areaId = String(body?.area_id ?? "").trim();
  const templateId = String(body?.audit_template_id ?? "").trim();
  const roomNumber = typeof body?.room_number === "string" ? body.room_number.trim() || null : null;

  if (!areaId) return jsonError("area_id es obligatorio.");
  if (!templateId) return jsonError("audit_template_id es obligatorio.");

  const admin = supabaseAdmin();
  const [{ data: area, error: areaErr }, { data: template, error: templateErr }] = await Promise.all([
    admin.from("areas").select("id, hotel_id").eq("id", areaId).maybeSingle(),
    admin
      .from("audit_templates")
      .select("id, hotel_id, area_id, active")
      .eq("id", templateId)
      .maybeSingle(),
  ]);

  if (areaErr) return jsonError(areaErr.message, 500);
  if (!area?.id || String(area.hotel_id ?? "") !== hotelResult.hotelId) {
    return jsonError("El área no pertenece al hotel activo.", 403);
  }

  if (templateErr) return jsonError(templateErr.message, 500);
  if (
    !template?.id ||
    String(template.hotel_id ?? "") !== hotelResult.hotelId ||
    String(template.area_id ?? "") !== areaId ||
    template.active === false
  ) {
    return jsonError("La plantilla no pertenece al hotel activo o área seleccionada.", 403);
  }

  const channel: "quality" | "internal" =
    caller.profile.role === "quality" ? "quality" : "internal";

  const { data, error } = await admin
    .from("audit_runs")
    .insert({
      hotel_id: hotelResult.hotelId,
      area_id: areaId,
      audit_template_id: templateId,
      status: "draft",
      score: null,
      notes: null,
      room_number: roomNumber,
      executed_at: new Date().toISOString(),
      executed_by: caller.profile.id,
      audit_channel: channel,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    return jsonError(error?.message ?? "No se pudo crear la auditoría.", 500);
  }

  return NextResponse.json({ ok: true, run_id: String(data.id) });
}
