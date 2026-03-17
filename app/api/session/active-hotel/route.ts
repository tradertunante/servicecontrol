import { NextRequest, NextResponse } from "next/server";

import { HOTEL_SCOPE_COOKIE } from "@/lib/auth/cookies";
import { authorizeRouteRequest, getActiveHotel } from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function buildCookieOptions() {
  return {
    httpOnly: false,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

export async function GET(request: NextRequest) {
  const caller = await authorizeRouteRequest(request);
  if (!caller) return jsonError("No autorizado.", 401);

  const activeHotel = await getActiveHotel(request, caller.profile);

  return NextResponse.json({
    ok: activeHotel.ok,
    hotel_id: activeHotel.ok ? activeHotel.hotelId : null,
    error: activeHotel.ok ? null : activeHotel.error,
    role: caller.profile.role,
    profile_hotel_id: caller.profile.hotel_id ?? null,
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

  if (error) return jsonError(error.message, 500);
  if (!data?.id) return jsonError("El hotel seleccionado no existe.", 404);

  response.cookies.set(HOTEL_SCOPE_COOKIE, String(data.id), buildCookieOptions());
  return response;
}
