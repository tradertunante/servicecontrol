import { NextRequest } from "next/server";

import { normalizeMembershipRole } from "@/lib/auth/hotelMemberships";
import { jsonDbError } from "@/lib/api/response";
import { parseUUID, isErrorResponse } from "@/lib/api/validate";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { jsonError, jsonOk, requireSuperadminRoute } from "@/lib/superadmin/server";

// Gestión de membresías multi-hotel (solo superadmin).
// Los triggers de la migración 20261004100000 mantienen profiles.hotel_id/role
// sincronizados con la membresía del hotel activo.

async function loadTargetUser(userId: string) {
  const { data, error } = await supabaseAdmin()
    .from("profiles")
    .select("id, full_name, email, role, hotel_id")
    .eq("id", userId)
    .maybeSingle();

  if (error) return { error };
  if (!data) return { notFound: true as const };
  if (data.role?.trim().toLowerCase() === "superadmin") return { superadmin: true as const };
  return { user: data };
}

async function listMemberships(userId: string) {
  const admin = supabaseAdmin();
  const { data: rows, error } = await admin
    .from("hotel_memberships")
    .select("hotel_id, role, active, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) return { error };

  const hotelIds = (rows ?? []).map((r) => r.hotel_id);
  const { data: hotels } = hotelIds.length
    ? await admin.from("hotels").select("id, name").in("id", hotelIds)
    : { data: [] as { id: string; name: string | null }[] };
  const names = new Map((hotels ?? []).map((h) => [h.id, h.name ?? ""]));

  return {
    memberships: (rows ?? []).map((r) => ({
      hotel_id: r.hotel_id,
      hotel_name: names.get(r.hotel_id) ?? "",
      role: r.role,
      active: r.active,
    })),
  };
}

export async function GET(request: NextRequest) {
  const caller = await requireSuperadminRoute(request);
  if (!caller) return jsonError("No autorizado.", 401);

  const userId = request.nextUrl.searchParams.get("user_id");
  const email = request.nextUrl.searchParams.get("email")?.trim().toLowerCase();

  let resolvedId = userId;
  if (!resolvedId && email) {
    const { data, error } = await supabaseAdmin()
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    if (error) return jsonDbError(error);
    if (!data) return jsonError("Usuario no encontrado.", 404);
    resolvedId = data.id;
  }

  const id = parseUUID(resolvedId, "user_id");
  if (isErrorResponse(id)) return id;

  const target = await loadTargetUser(id);
  if ("error" in target) return jsonDbError(target.error as Parameters<typeof jsonDbError>[0]);
  if ("notFound" in target) return jsonError("Usuario no encontrado.", 404);
  if ("superadmin" in target) return jsonError("Los superadmin no tienen membresías de hotel.", 400);

  const result = await listMemberships(id);
  if ("error" in result) return jsonDbError(result.error as Parameters<typeof jsonDbError>[0]);

  return jsonOk({
    user: target.user,
    memberships: result.memberships,
  });
}

export async function POST(request: NextRequest) {
  const caller = await requireSuperadminRoute(request);
  if (!caller) return jsonError("No autorizado.", 401);

  const body = await request.json().catch(() => null);
  const userId = parseUUID(body?.user_id, "user_id");
  if (isErrorResponse(userId)) return userId;
  const hotelId = parseUUID(body?.hotel_id, "hotel_id");
  if (isErrorResponse(hotelId)) return hotelId;
  const role = normalizeMembershipRole(body?.role);
  if (!role) return jsonError("role no es válido para una membresía.");

  const target = await loadTargetUser(userId);
  if ("error" in target) return jsonDbError(target.error as Parameters<typeof jsonDbError>[0]);
  if ("notFound" in target) return jsonError("Usuario no encontrado.", 404);
  if ("superadmin" in target) return jsonError("Los superadmin no tienen membresías de hotel.", 400);

  const admin = supabaseAdmin();
  const { data: hotel, error: hotelError } = await admin
    .from("hotels")
    .select("id")
    .eq("id", hotelId)
    .maybeSingle();
  if (hotelError) return jsonDbError(hotelError);
  if (!hotel) return jsonError("El hotel no existe.", 404);

  const { data: existing } = await admin
    .from("hotel_memberships")
    .select("hotel_id")
    .eq("user_id", userId)
    .eq("hotel_id", hotelId)
    .maybeSingle();
  if (existing) return jsonError("El usuario ya pertenece a ese hotel.", 409);

  const { error: insertError } = await admin
    .from("hotel_memberships")
    .insert({ user_id: userId, hotel_id: hotelId, role, active: true });
  if (insertError) return jsonDbError(insertError);

  // Si el usuario no tenía hotel activo, este pasa a serlo.
  if (!target.user.hotel_id) {
    const { error: profileError } = await admin
      .from("profiles")
      .update({ hotel_id: hotelId, role })
      .eq("id", userId);
    if (profileError) return jsonDbError(profileError);
  }

  return jsonOk({ ok: true });
}

export async function PATCH(request: NextRequest) {
  const caller = await requireSuperadminRoute(request);
  if (!caller) return jsonError("No autorizado.", 401);

  const body = await request.json().catch(() => null);
  const userId = parseUUID(body?.user_id, "user_id");
  if (isErrorResponse(userId)) return userId;
  const hotelId = parseUUID(body?.hotel_id, "hotel_id");
  if (isErrorResponse(hotelId)) return hotelId;

  const updates: Record<string, unknown> = {};
  if (body && Object.prototype.hasOwnProperty.call(body, "role")) {
    const role = normalizeMembershipRole(body.role);
    if (!role) return jsonError("role no es válido para una membresía.");
    updates.role = role;
  }
  if (body && Object.prototype.hasOwnProperty.call(body, "active")) {
    if (typeof body.active !== "boolean") return jsonError("active debe ser boolean.");
    updates.active = body.active;
  }
  if (Object.keys(updates).length === 0) return jsonError("Nada que actualizar.");

  const { data, error } = await supabaseAdmin()
    .from("hotel_memberships")
    .update(updates)
    .eq("user_id", userId)
    .eq("hotel_id", hotelId)
    .select("hotel_id")
    .maybeSingle();
  if (error) return jsonDbError(error);
  if (!data) return jsonError("Membresía no encontrada.", 404);

  return jsonOk({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const caller = await requireSuperadminRoute(request);
  if (!caller) return jsonError("No autorizado.", 401);

  const userId = parseUUID(request.nextUrl.searchParams.get("user_id"), "user_id");
  if (isErrorResponse(userId)) return userId;
  const hotelId = parseUUID(request.nextUrl.searchParams.get("hotel_id"), "hotel_id");
  if (isErrorResponse(hotelId)) return hotelId;

  const { data, error } = await supabaseAdmin()
    .from("hotel_memberships")
    .delete()
    .eq("user_id", userId)
    .eq("hotel_id", hotelId)
    .select("hotel_id");
  if (error) return jsonDbError(error);
  if (!data?.length) return jsonError("Membresía no encontrada.", 404);

  return jsonOk({ ok: true });
}
