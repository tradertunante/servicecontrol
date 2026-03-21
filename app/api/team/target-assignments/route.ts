import { NextRequest, NextResponse } from "next/server";

import {
  authorizeRouteRequest,
  hasAreaScopeForProfile,
  resolveRouteHotelScope,
} from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { jsonError } from "@/lib/api/response";

type AssignmentInput = {
  id?: string;
  source_ids?: string[];
  user_id?: string;
  target_count?: number;
  active?: boolean;
};

export async function POST(request: NextRequest) {
  const caller = await authorizeRouteRequest(request, {
    roles: ["manager", "quality", "admin", "superadmin"],
  });
  if (!caller) return jsonError("No autorizado.", 401);

  const hotelResult = resolveRouteHotelScope(caller.profile, null);
  if (!hotelResult.ok) return jsonError(hotelResult.error, hotelResult.status);

  const body = await request.json().catch(() => null);
  const areaId = String(body?.area_id ?? "").trim();
  const period = String(body?.period ?? "").trim();
  const templates = Array.isArray(body?.templates) ? (body.templates as Array<any>) : [];

  if (!areaId || !period) {
    return jsonError("area_id y period son obligatorios.");
  }

  const hasAreaScope = await hasAreaScopeForProfile(caller.profile, hotelResult.hotelId, areaId);
  if (!hasAreaScope) return jsonError("No tienes acceso a esta área.", 403);

  const admin = supabaseAdmin();
  const { data: area, error: areaErr } = await admin
    .from("areas")
    .select("id")
    .eq("id", areaId)
    .eq("hotel_id", hotelResult.hotelId)
    .maybeSingle();

  if (areaErr) return jsonError(areaErr.message, 500);
  if (!area?.id) return jsonError("El área no pertenece al hotel activo.", 403);

  const templateIds = Array.from(
    new Set(
      templates
        .map((entry) => String(entry?.audit_template_id ?? "").trim())
        .filter(Boolean)
    )
  );

  if (templateIds.length === 0) {
    return NextResponse.json({ ok: true, saved: 0 });
  }

  const assignmentRows = templates.flatMap((entry) =>
    (Array.isArray(entry?.rows) ? entry.rows : []).map((row: AssignmentInput) => ({
      templateId: String(entry?.audit_template_id ?? "").trim(),
      row,
    }))
  );

  const userIds = Array.from(
    new Set(
      assignmentRows
        .map((entry) => String(entry.row?.user_id ?? "").trim())
        .filter(Boolean)
    )
  );

  const [templatesRes, usersRes, areaAccessRes, existingRes] = await Promise.all([
    admin
      .from("area_template_targets")
      .select("audit_template_id")
      .eq("hotel_id", hotelResult.hotelId)
      .eq("area_id", areaId)
      .eq("period", period)
      .eq("active", true)
      .in("audit_template_id", templateIds),
    userIds.length
      ? admin
          .from("profiles")
          .select("id, hotel_id, active")
          .eq("hotel_id", hotelResult.hotelId)
          .eq("active", true)
          .in("id", userIds)
      : Promise.resolve({ data: [], error: null }),
    userIds.length
      ? admin
          .from("user_area_access")
          .select("user_id")
          .eq("hotel_id", hotelResult.hotelId)
          .eq("area_id", areaId)
          .in("user_id", userIds)
      : Promise.resolve({ data: [], error: null }),
    userIds.length
      ? admin
          .from("area_template_target_assignments")
          .select("id, audit_template_id, user_id")
          .eq("hotel_id", hotelResult.hotelId)
          .eq("area_id", areaId)
          .eq("period", period)
          .eq("active", true)
          .in("audit_template_id", templateIds)
          .in("user_id", userIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (templatesRes.error) return jsonError(templatesRes.error.message, 500);
  if (usersRes.error) return jsonError(usersRes.error.message, 500);
  if (areaAccessRes.error) return jsonError(areaAccessRes.error.message, 500);
  if (existingRes.error) return jsonError(existingRes.error.message, 500);

  const allowedTemplateIds = new Set(
    (templatesRes.data ?? []).map((row) => String(row.audit_template_id ?? "")).filter(Boolean)
  );
  const allowedUserIds = new Set(
    (usersRes.data ?? []).map((row) => String(row.id ?? "")).filter(Boolean)
  );
  const allowedAreaUserIds = new Set(
    (areaAccessRes.data ?? []).map((row) => String(row.user_id ?? "")).filter(Boolean)
  );

  const existingByTemplateUser = new Map<string, string[]>();
  for (const row of existingRes.data ?? []) {
    const key = `${String(row.audit_template_id ?? "")}:${String(row.user_id ?? "")}`;
    const ids = existingByTemplateUser.get(key) ?? [];
    ids.push(String(row.id ?? ""));
    existingByTemplateUser.set(key, ids.filter(Boolean));
  }

  let saved = 0;

  for (const entry of assignmentRows) {
    const templateId = entry.templateId;
    const userId = String(entry.row?.user_id ?? "").trim();
    if (!templateId || !userId) {
      return jsonError("Cada asignación debe incluir audit_template_id y user_id.");
    }
    if (!allowedTemplateIds.has(templateId)) {
      return jsonError("La plantilla no pertenece al área/hotel activo.", 403);
    }
    if (!allowedUserIds.has(userId) || !allowedAreaUserIds.has(userId)) {
      return jsonError("El usuario asignado no pertenece al área/hotel activo.", 403);
    }

    const normalizedTargetCount = Math.max(
      0,
      Math.floor(Number(entry.row?.target_count ?? 0) || 0)
    );
    const sourceIds = Array.isArray(entry.row?.source_ids)
      ? entry.row!.source_ids!.map((id: string) => String(id).trim()).filter(Boolean)
      : [];
    const canonicalId =
      String(entry.row?.id ?? "").trim() ||
      sourceIds[0] ||
      existingByTemplateUser.get(`${templateId}:${userId}`)?.[0] ||
      null;

    const duplicateIds = Array.from(
      new Set(
        [
          ...sourceIds,
          ...(existingByTemplateUser.get(`${templateId}:${userId}`) ?? []),
        ].filter((id) => id && id !== canonicalId)
      )
    );

    const payload = {
      id: canonicalId ?? undefined,
      hotel_id: hotelResult.hotelId,
      area_id: areaId,
      audit_template_id: templateId,
      user_id: userId,
      period,
      target_count: normalizedTargetCount,
      active: entry.row?.active !== false,
      created_by: caller.profile.id,
    };

    const upsertResult = await admin
      .from("area_template_target_assignments")
      .upsert(payload, {
        onConflict: "hotel_id,area_id,audit_template_id,user_id,period",
        ignoreDuplicates: false,
      })
      .select("id")
      .maybeSingle();

    if (upsertResult.error) return jsonError(upsertResult.error.message, 500);

    if (duplicateIds.length > 0) {
      const { error: deactivateErr } = await admin
        .from("area_template_target_assignments")
        .update({ active: false })
        .eq("hotel_id", hotelResult.hotelId)
        .in("id", duplicateIds);

      if (deactivateErr) return jsonError(deactivateErr.message, 500);
    }

    saved += 1;
  }

  return NextResponse.json({ ok: true, saved });
}
