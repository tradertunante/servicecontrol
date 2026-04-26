import { NextRequest, NextResponse } from "next/server";

import { HOTEL_SCOPE_COOKIE } from "@/lib/auth/cookies";
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

export async function GET(request: NextRequest) {
  const caller = await authorizeRouteRequest(request);
  if (!caller) return jsonError("No autorizado.", 401);

  const activeHotel = await getActiveHotel(request, caller.profile);

  let hotelName: string | null = null;
  let trialHotelName: string | null = null;

  if (activeHotel.ok) {
    const admin = supabaseAdmin();

    const [hotelResult, profileResult] = await Promise.all([
      admin.from("hotels").select("name").eq("id", activeHotel.hotelId).maybeSingle(),
      admin.from("profiles").select("trial_hotel_name, is_trial").eq("id", caller.profile.id).maybeSingle(),
    ]);

    hotelName = hotelResult.data?.name ?? null;
    trialHotelName = profileResult.data?.trial_hotel_name ?? null;
  }

  return NextResponse.json({
    ok: activeHotel.ok,
    hotel_id: activeHotel.ok ? activeHotel.hotelId : null,
    hotel_name: trialHotelName ?? hotelName,
    error: activeHotel.ok ? null : activeHotel.error,
    role: caller.profile.role,
    profile_hotel_id: caller.profile.hotel_id ?? null,
    is_trial: trialHotelName !== null,
  });
}

export async function POST(request: NextRequest) {
  const caller = await authorizeRouteRequest(request, { roles: ["superadmin"] });
  if (!caller) return jsonError("No autorizado.", 401);

  const body = await request.json().catch(() => null);
  const hotelId = String(body?.hotel_id ?? "").trim() || null;
  const clear = body?.clear === true || !hotelId;

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
