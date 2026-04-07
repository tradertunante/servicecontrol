import { NextRequest, NextResponse } from "next/server";

import { authorizeRouteRequest } from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { jsonError } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  const caller = await authorizeRouteRequest(request);
  if (!caller) return jsonError("No autorizado.", 401);

  const { profile } = caller;

  const hotelId = profile.hotel_id;
  if (!hotelId) return jsonError("Sin hotel asignado.", 400);

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("user_area_access")
    .select("area_id")
    .eq("user_id", profile.id)
    .eq("hotel_id", hotelId);

  if (error) return jsonError(error.message, 500);

  const areaIds = Array.from(
    new Set(
      (data ?? [])
        .map((row) => row.area_id as string | null)
        .filter((id): id is string => !!id)
    )
  );

  return NextResponse.json({ ok: true, areaIds });
}
