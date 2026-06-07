import { NextRequest, NextResponse } from "next/server";

import { authorizeRouteRequest } from "@/lib/auth/server";
import { resolveManagedHotelId } from "@/lib/auth/userManagement";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { jsonError, jsonDbError } from "@/lib/api/response";
import type { SupabaseClient } from "@supabase/supabase-js";

async function autoAssignPackArea(admin: SupabaseClient, packId: string, hotelId: string) {
  const { data: pack } = await admin
    .from("global_audit_packs")
    .select("default_area_name")
    .eq("id", packId)
    .maybeSingle();

  const areaName = pack?.default_area_name;
  if (!areaName) return;

  // Find or create the area
  let areaId: string;
  const { data: existing } = await admin
    .from("areas")
    .select("id")
    .eq("hotel_id", hotelId)
    .eq("name", areaName)
    .maybeSingle();

  if (existing?.id) {
    areaId = existing.id;
  } else {
    const { data: created, error: createErr } = await admin
      .from("areas")
      .insert({ hotel_id: hotelId, name: areaName, type: "standards" })
      .select("id")
      .single();
    if (createErr || !created) return;
    areaId = created.id;
  }

  // Assign all hotel templates from this pack to the area
  await admin
    .from("audit_templates")
    .update({ area_id: areaId })
    .eq("hotel_id", hotelId)
    .eq("pack_id", packId)
    .is("area_id", null);
}

export async function POST(request: NextRequest) {
  try {
    const caller = await authorizeRouteRequest(request, { roles: ["admin", "superadmin"] });
    if (!caller) return jsonError("No autorizado.", 401);

    const body = await request.json().catch(() => null);
    const action = String(body?.action ?? "").trim();
    const hotelResult = resolveManagedHotelId(caller.profile);

    if (!hotelResult.ok) {
      return jsonError(hotelResult.error, hotelResult.status);
    }

    const admin = supabaseAdmin();

    if (action === "clone_pack") {
      const packId = String(body?.pack_id ?? "").trim();
      if (!packId) return jsonError("pack_id es obligatorio.", 400);

      const { error } = await admin.rpc("clone_global_audit_pack_to_hotel", {
        p_pack_id: packId,
        p_target_hotel_id: hotelResult.hotelId,
      });

      if (error) return jsonDbError(error);

      await autoAssignPackArea(admin, packId, hotelResult.hotelId);

      return NextResponse.json({ ok: true });
    }

    if (action === "sync_pack") {
      const packId = String(body?.pack_id ?? "").trim();
      if (!packId) return jsonError("pack_id es obligatorio.", 400);

      const { data, error } = await admin.rpc("sync_global_audit_pack_to_hotel", {
        p_pack_id: packId,
        p_target_hotel_id: hotelResult.hotelId,
      });

      if (error) return jsonDbError(error);

      await autoAssignPackArea(admin, packId, hotelResult.hotelId);

      return NextResponse.json({ ok: true, added: data });
    }

    if (action === "set_template_area") {
      const templateId = String(body?.template_id ?? "").trim();
      const areaId = body?.area_id == null ? null : String(body.area_id).trim() || null;

      if (!templateId) return jsonError("template_id es obligatorio.", 400);

      if (areaId) {
        const { data: area, error: areaError } = await admin
          .from("areas")
          .select("id")
          .eq("id", areaId)
          .eq("hotel_id", hotelResult.hotelId)
          .maybeSingle();

        if (areaError) return jsonDbError(areaError);
        if (!area?.id) return jsonError("El area no pertenece al hotel seleccionado.", 403);
      }

      const { error } = await admin
        .from("audit_templates")
        .update({ area_id: areaId })
        .eq("id", templateId)
        .eq("hotel_id", hotelResult.hotelId);

      if (error) return jsonDbError(error);
      return NextResponse.json({ ok: true });
    }

    if (action === "clone_template") {
      const templateId = String(body?.template_id ?? "").trim();
      const newName = String(body?.new_name ?? "").trim();

      if (!templateId) return jsonError("template_id es obligatorio.", 400);
      if (!newName) return jsonError("new_name es obligatorio.", 400);

      const { data: template, error: templateError } = await admin
        .from("audit_templates")
        .select("id")
        .eq("id", templateId)
        .eq("hotel_id", hotelResult.hotelId)
        .maybeSingle();

      if (templateError) return jsonDbError(templateError);
      if (!template?.id) return jsonError("La plantilla no pertenece al hotel seleccionado.", 403);

      const { error } = await admin.rpc("clone_hotel_audit_template", {
        p_template_id: templateId,
        p_target_hotel_id: hotelResult.hotelId,
        p_new_name: newName,
      });

      if (error) return jsonDbError(error);
      return NextResponse.json({ ok: true });
    }

    if (action === "delete_template") {
      const templateId = String(body?.template_id ?? "").trim();
      if (!templateId) return jsonError("template_id es obligatorio.", 400);

      // Verify it belongs to this hotel before deleting
      const { data: template, error: checkError } = await admin
        .from("audit_templates")
        .select("id")
        .eq("id", templateId)
        .eq("hotel_id", hotelResult.hotelId)
        .maybeSingle();

      if (checkError) return jsonDbError(checkError);
      if (!template?.id) return jsonError("La plantilla no pertenece al hotel seleccionado.", 403);

      const { error } = await admin
        .from("audit_templates")
        .delete()
        .eq("id", templateId)
        .eq("hotel_id", hotelResult.hotelId);

      if (error) return jsonDbError(error);
      return NextResponse.json({ ok: true });
    }

    return jsonError("Accion no soportada.", 400);
  } catch (error) {
    return jsonDbError(error instanceof Error ? { message: error.message } : null, "Error inesperado.");
  }
}
