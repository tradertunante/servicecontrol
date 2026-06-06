import { NextRequest, NextResponse } from "next/server";

import { authorizeRouteRequest, resolveRouteHotelScope } from "@/lib/auth/server";
import { jsonError, jsonDbError } from "@/lib/api/response";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logAdminAction } from "@/lib/admin/auditLog";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const caller = await authorizeRouteRequest(request, { roles: ["admin", "superadmin"] });
    if (!caller) return jsonError("No autorizado.", 401);

    const hotelResult = resolveRouteHotelScope(caller.profile, null);
    if (!hotelResult.ok) return jsonError(hotelResult.error, hotelResult.status);

    const admin = supabaseAdmin();
    const { data: shopper, error } = await admin
      .from("profiles")
      .select("id, full_name, email, active, invited_at, access_expires_at")
      .eq("id", params.id)
      .eq("hotel_id", hotelResult.hotelId)
      .eq("role", "mystery_shopper")
      .maybeSingle();

    if (error) return jsonDbError(error);
    if (!shopper) return jsonError("Mystery shopper no encontrado.", 404);

    return NextResponse.json({
      ok: true,
      shopper: {
        ...shopper,
        is_expired: shopper.access_expires_at
          ? new Date(shopper.access_expires_at) < new Date()
          : false,
      },
    });
  } catch (error) {
    return jsonDbError(error instanceof Error ? { message: error.message } : null, "Error inesperado.");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const caller = await authorizeRouteRequest(request, { roles: ["admin", "superadmin"] });
    if (!caller) return jsonError("No autorizado.", 401);

    const hotelResult = resolveRouteHotelScope(caller.profile, null);
    if (!hotelResult.ok) return jsonError(hotelResult.error, hotelResult.status);

    const body = await request.json().catch(() => null);
    const extraDays = Math.max(1, Math.min(365, Number(body?.extra_days ?? 7)));

    const admin = supabaseAdmin();

    // Fetch current expiry
    const { data: current, error: fetchErr } = await admin
      .from("profiles")
      .select("access_expires_at")
      .eq("id", params.id)
      .eq("hotel_id", hotelResult.hotelId)
      .eq("role", "mystery_shopper")
      .maybeSingle();

    if (fetchErr) return jsonDbError(fetchErr);
    if (!current) return jsonError("Mystery shopper no encontrado.", 404);

    // Extend from today if already expired, otherwise from current expiry
    const base = current.access_expires_at && new Date(current.access_expires_at) > new Date()
      ? new Date(current.access_expires_at)
      : new Date();

    const newExpiry = new Date(base.getTime() + extraDays * 24 * 60 * 60 * 1000).toISOString();

    const { error: updateErr } = await admin
      .from("profiles")
      .update({ access_expires_at: newExpiry, active: true })
      .eq("id", params.id)
      .eq("hotel_id", hotelResult.hotelId);

    if (updateErr) return jsonDbError(updateErr);

    // Re-sync area access (idempotent — ensures shopper can always audit all active areas)
    const { data: areas } = await admin
      .from("areas")
      .select("id")
      .eq("hotel_id", hotelResult.hotelId)
      .eq("active", true);

    if (areas && areas.length > 0) {
      await admin.from("user_area_access").upsert(
        areas.map((a) => ({ user_id: params.id, hotel_id: hotelResult.hotelId, area_id: a.id })),
        { onConflict: "user_id,area_id" }
      );
    }

    void logAdminAction({
      hotelId: hotelResult.hotelId,
      actorId: caller.profile.id,
      actorName: caller.profile.full_name ?? caller.profile.id,
      targetId: params.id,
      targetName: params.id,
      action: "mystery_shopper_extended",
      newValue: `+${extraDays} días → ${newExpiry}`,
    });

    return NextResponse.json({ ok: true, access_expires_at: newExpiry });
  } catch (error) {
    return jsonDbError(error instanceof Error ? { message: error.message } : null, "Error inesperado.");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const caller = await authorizeRouteRequest(request, { roles: ["admin", "superadmin"] });
    if (!caller) return jsonError("No autorizado.", 401);

    const hotelResult = resolveRouteHotelScope(caller.profile, null);
    if (!hotelResult.ok) return jsonError(hotelResult.error, hotelResult.status);

    const admin = supabaseAdmin();

    // Verify the target is actually a mystery_shopper of this hotel
    const { data: shopper, error: fetchErr } = await admin
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", params.id)
      .eq("hotel_id", hotelResult.hotelId)
      .eq("role", "mystery_shopper")
      .maybeSingle();

    if (fetchErr) return jsonDbError(fetchErr);
    if (!shopper) return jsonError("Mystery shopper no encontrado.", 404);

    // 1. Remove area access
    await admin.from("user_area_access").delete().eq("user_id", params.id);

    // 2. Delete profile row
    const { error: profileErr } = await admin
      .from("profiles")
      .delete()
      .eq("id", params.id)
      .eq("hotel_id", hotelResult.hotelId);

    if (profileErr) return jsonDbError(profileErr);

    // 3. Delete auth user
    const { error: authErr } = await admin.auth.admin.deleteUser(params.id);
    if (authErr) return jsonDbError(authErr);

    void logAdminAction({
      hotelId: hotelResult.hotelId,
      actorId: caller.profile.id,
      actorName: caller.profile.full_name ?? caller.profile.id,
      targetId: params.id,
      targetName: shopper.full_name ?? shopper.email ?? params.id,
      action: "mystery_shopper_deleted",
      newValue: null,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonDbError(error instanceof Error ? { message: error.message } : null, "Error inesperado.");
  }
}