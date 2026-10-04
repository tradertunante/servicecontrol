import { NextRequest, NextResponse } from "next/server";

import { HOTEL_SCOPE_COOKIE } from "@/lib/auth/cookies";
import { normalizeMembershipRole, sortAvailableHotels, type AvailableHotel } from "@/lib/auth/hotelMemberships";
import { authorizeRouteRequest, getActiveHotel } from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { jsonError, jsonDbError } from "@/lib/api/response";

function buildCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

async function loadAvailableHotels(userId: string, activeHotelId: string | null): Promise<AvailableHotel[]> {
  const admin = supabaseAdmin();
  const { data: memberships } = await admin
    .from("hotel_memberships")
    .select("hotel_id, role")
    .eq("user_id", userId)
    .eq("active", true);

  const rows = memberships ?? [];
  if (rows.length === 0) return [];

  const { data: hotels } = await admin
    .from("hotels")
    .select("id, name")
    .in("id", rows.map((m) => m.hotel_id));
  const names = new Map((hotels ?? []).map((h) => [h.id, h.name ?? ""]));

  return sortAvailableHotels(
    rows.map((m) => ({ id: m.hotel_id, name: names.get(m.hotel_id) ?? "", role: m.role })),
    activeHotelId
  );
}

export async function GET(request: NextRequest) {
  const caller = await authorizeRouteRequest(request);
  if (!caller) return jsonError("No autorizado.", 401);

  const activeHotel = await getActiveHotel(request, caller.profile);

  let hotelName: string | null = null;
  let trialHotelName: string | null = null;
  let isTrial = false;
  let trialExpiresAt: string | null = null;

  if (activeHotel.ok) {
    const admin = supabaseAdmin();

    const [hotelResult, profileResult] = await Promise.all([
      admin.from("hotels").select("name").eq("id", activeHotel.hotelId).maybeSingle(),
      admin.from("profiles").select("trial_hotel_name, is_trial, trial_expires_at").eq("id", caller.profile.id).maybeSingle(),
    ]);

    hotelName = hotelResult.data?.name ?? null;
    trialHotelName = profileResult.data?.trial_hotel_name ?? null;
    isTrial = profileResult.data?.is_trial ?? false;
    trialExpiresAt = profileResult.data?.trial_expires_at ?? null;
  }

  // El superadmin elige hotel desde /superadmin/hotels; el resto usa sus membresías.
  const availableHotels = caller.profile.role === "superadmin"
    ? []
    : await loadAvailableHotels(caller.profile.id, activeHotel.ok ? activeHotel.hotelId : null);

  return NextResponse.json({
    ok: activeHotel.ok,
    hotel_id: activeHotel.ok ? activeHotel.hotelId : null,
    hotel_name: trialHotelName ?? hotelName,
    error: activeHotel.ok ? null : activeHotel.error,
    role: caller.profile.role,
    profile_hotel_id: caller.profile.hotel_id ?? null,
    is_trial: isTrial,
    trial_expires_at: trialExpiresAt,
    available_hotels: availableHotels,
  });
}

// Usuario no superadmin: solo puede activar un hotel con membresía activa.
// El perfil toma el rol de esa membresía.
async function switchMemberHotel(userId: string, hotelId: string) {
  const admin = supabaseAdmin();
  const { data: membership, error } = await admin
    .from("hotel_memberships")
    .select("role")
    .eq("user_id", userId)
    .eq("hotel_id", hotelId)
    .eq("active", true)
    .maybeSingle();

  if (error) return jsonDbError(error);
  const role = normalizeMembershipRole(membership?.role);
  if (!role) return jsonError("No tienes acceso a ese hotel.", 403);

  const { error: updateError } = await admin
    .from("profiles")
    .update({ hotel_id: hotelId, role })
    .eq("id", userId);

  if (updateError) return jsonDbError(updateError);
  return NextResponse.json({ ok: true, hotel_id: hotelId });
}

export async function POST(request: NextRequest) {
  const caller = await authorizeRouteRequest(request);
  if (!caller) return jsonError("No autorizado.", 401);

  const body = await request.json().catch(() => null);
  const hotelId = String(body?.hotel_id ?? "").trim() || null;
  const clear = body?.clear === true || !hotelId;

  if (caller.profile.role !== "superadmin") {
    // Limpiar el hotel al cerrar sesión no toca la membresía.
    if (clear) return NextResponse.json({ ok: true, hotel_id: caller.profile.hotel_id ?? null });
    return switchMemberHotel(caller.profile.id, hotelId);
  }

  const response = NextResponse.json({
    ok: true,
    hotel_id: clear ? null : hotelId,
  });

  if (clear) {
    response.cookies.set(HOTEL_SCOPE_COOKIE, "", {
      ...buildCookieOptions(),
      maxAge: 0,
    });
    return response;
  }

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("hotels")
    .select("id")
    .eq("id", hotelId)
    .maybeSingle();

  if (error) return jsonDbError(error);
  if (!data?.id) return jsonError("El hotel seleccionado no existe.", 404);

  response.cookies.set(HOTEL_SCOPE_COOKIE, String(data.id), buildCookieOptions());
  return response;
}
