import { NextRequest, NextResponse } from "next/server";

import { authorizeRouteRequest, resolveRouteHotelScope } from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { jsonError, jsonDbError } from "@/lib/api/response";

async function getAdminScope(request: NextRequest) {
  const caller = await authorizeRouteRequest(request, {
    roles: ["admin", "superadmin", "general_manager", "quality"],
  });
  if (!caller) return { ok: false as const, error: "No autorizado.", status: 401 };

  const hotelResult = await resolveRouteHotelScope(caller.profile, null);
  if (!hotelResult.ok) return hotelResult;

  return { ok: true as const, hotelId: hotelResult.hotelId, caller };
}

export async function GET(request: NextRequest) {
  const scope = await getAdminScope(request);
  if (!scope.ok) return jsonError(scope.error, scope.status);

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("report_subscriptions")
    .select("id,email,frequency,scope,area_ids,channel,active,created_at")
    .eq("hotel_id", scope.hotelId)
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (error) return jsonDbError(error);

  return NextResponse.json({ ok: true, subscriptions: data ?? [] });
}

export async function POST(request: NextRequest) {
  const scope = await getAdminScope(request);
  if (!scope.ok) return jsonError(scope.error, scope.status);

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const frequency = ["instant", "weekly", "monthly"].includes(body?.frequency)
    ? body.frequency
    : "weekly";
  const subScope = ["all_areas", "my_areas", "specific_areas"].includes(body?.scope)
    ? body.scope
    : "all_areas";
  const channel = ["all", "quality", "internal"].includes(body?.channel)
    ? body.channel
    : "all";
  const areaIds = Array.isArray(body?.area_ids)
    ? body.area_ids.filter((id: unknown) => typeof id === "string")
    : null;

  if (!email || !email.includes("@")) {
    return jsonError("Email inválido.", 400);
  }

  if (subScope === "specific_areas" && (!areaIds || areaIds.length === 0)) {
    return jsonError("Debes seleccionar al menos un área.", 400);
  }

  const admin = supabaseAdmin();

  // Validate that all area_ids belong to the hotel
  if (subScope === "specific_areas" && areaIds && areaIds.length > 0) {
    const { data: validAreas, error: areaErr } = await admin
      .from("areas")
      .select("id")
      .eq("hotel_id", scope.hotelId)
      .in("id", areaIds);

    if (areaErr) return jsonDbError(areaErr);

    const validIds = new Set((validAreas ?? []).map((a) => a.id));
    const invalid = areaIds.filter((id: string) => !validIds.has(id));
    if (invalid.length > 0) {
      return jsonError("Una o más áreas no pertenecen a este hotel.", 400);
    }
  }
  const { data, error } = await admin
    .from("report_subscriptions")
    .insert({
      hotel_id: scope.hotelId,
      email,
      frequency,
      scope: subScope,
      area_ids: subScope === "specific_areas" ? areaIds : null,
      channel,
      active: true,
      created_by: scope.caller.profile.id,
    })
    .select("id,email,frequency,scope,area_ids,channel,active,created_at")
    .single();

  if (error) return jsonDbError(error);

  return NextResponse.json({ ok: true, subscription: data });
}

export async function DELETE(request: NextRequest) {
  const scope = await getAdminScope(request);
  if (!scope.ok) return jsonError(scope.error, scope.status);

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  if (!id) return jsonError("id es obligatorio.", 400);

  const admin = supabaseAdmin();
  const { error } = await admin
    .from("report_subscriptions")
    .delete()
    .eq("id", id)
    .eq("hotel_id", scope.hotelId);

  if (error) return jsonDbError(error);

  return NextResponse.json({ ok: true });
}
