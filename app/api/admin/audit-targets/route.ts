import { NextRequest, NextResponse } from "next/server";

import { authorizeRouteRequest, resolveRouteHotelScope } from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { jsonError } from "@/lib/api/response";

async function getHotelScope(request: NextRequest) {
  const caller = await authorizeRouteRequest(request, { roles: ["admin", "superadmin"] });
  if (!caller) return { ok: false as const, error: "No autorizado.", status: 401 };

  const hotelResult = resolveRouteHotelScope(caller.profile, null);
  if (!hotelResult.ok) return hotelResult;

  return { ok: true as const, caller, hotelId: hotelResult.hotelId };
}

export async function POST(request: NextRequest) {
  const scope = await getHotelScope(request);
  if (!scope.ok) return jsonError(scope.error, scope.status);

  const body = await request.json().catch(() => null);
  const areaId = String(body?.area_id ?? "").trim();
  const templateId = String(body?.audit_template_id ?? "").trim();
  const period = String(body?.period ?? "").trim();
  const targetCount = Number(body?.target_count ?? 0);
  const active = body?.active !== false;
  const editId = String(body?.id ?? "").trim() || null;

  if (!areaId || !templateId || !period) {
    return jsonError("area_id, audit_template_id y period son obligatorios.");
  }

  const admin = supabaseAdmin();
  const [{ data: area, error: areaErr }, { data: template, error: templateErr }] = await Promise.all([
    admin.from("areas").select("id").eq("id", areaId).eq("hotel_id", scope.hotelId).maybeSingle(),
    admin
      .from("audit_templates")
      .select("id, area_id")
      .eq("id", templateId)
      .eq("hotel_id", scope.hotelId)
      .maybeSingle(),
  ]);

  if (areaErr) return jsonError(areaErr.message, 500);
  if (!area?.id) return jsonError("El área no pertenece al hotel activo.", 403);
  if (templateErr) return jsonError(templateErr.message, 500);
  if (!template?.id || (template.area_id && String(template.area_id) !== areaId)) {
    return jsonError("La plantilla no pertenece al área/hotel activo.", 403);
  }

  const payload = {
    id: editId ?? undefined,
    hotel_id: scope.hotelId,
    area_id: areaId,
    audit_template_id: templateId,
    period,
    target_count: Number.isFinite(targetCount) ? targetCount : 0,
    active,
    created_by: scope.caller.profile.id,
  };

  const result = await admin
    .from("area_template_targets")
    .upsert(payload, {
      onConflict: "hotel_id,area_id,audit_template_id,period",
      ignoreDuplicates: false,
    })
    .select("id")
    .maybeSingle();

  if (result.error) return jsonError(result.error.message, 500);
  return NextResponse.json({ ok: true, id: result.data?.id ?? editId });
}

export async function DELETE(request: NextRequest) {
  const scope = await getHotelScope(request);
  if (!scope.ok) return jsonError(scope.error, scope.status);

  const body = await request.json().catch(() => null);
  const rowId = String(body?.id ?? "").trim();
  if (!rowId) return jsonError("id es obligatorio.");

  const admin = supabaseAdmin();
  const { error } = await admin
    .from("area_template_targets")
    .delete()
    .eq("id", rowId)
    .eq("hotel_id", scope.hotelId);

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true });
}
