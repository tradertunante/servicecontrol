import { NextRequest, NextResponse } from "next/server";

import { authorizeRouteRequest } from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveManagedHotelId } from "@/lib/auth/userManagement";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const caller = await authorizeRouteRequest(request, { roles: ["admin", "superadmin"] });
    if (!caller) return jsonError("No autorizado.", 401);

    const hotelResult = resolveManagedHotelId(caller.profile);
    if (!hotelResult.ok) {
      return jsonError(hotelResult.error, hotelResult.status);
    }

    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("profiles")
      .select("id, full_name, email, role, active, hotel_id")
      .eq("hotel_id", hotelResult.hotelId)
      .order("full_name", { ascending: true });

    if (error) return jsonError(error.message, 500);

    const users =
      caller.profile.role === "superadmin"
        ? data ?? []
        : (data ?? []).filter((row) => String(row.role ?? "").trim().toLowerCase() !== "superadmin");

    return NextResponse.json({
      ok: true,
      hotel_id: hotelResult.hotelId,
      users,
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Error inesperado.", 500);
  }
}
