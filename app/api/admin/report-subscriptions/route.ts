import { NextRequest, NextResponse } from "next/server";

import { authorizeRouteRequest, resolveRouteHotelScope } from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { jsonError, jsonDbError } from "@/lib/api/response";

async function getAdminScope(request: NextRequest) {
  const caller = await authorizeRouteRequest(request, { roles: ["admin", "superadmin"] });
  if (!caller) return { ok: false as const, error: "No autorizado.", status: 401 };

  const hotelResult = resolveRouteHotelScope(caller.profile, null);
  if (!hotelResult.ok) return hotelResult;

  return { ok: true as const, hotelId: hotelResult.hotelId, caller };
}

export async function GET(request: NextRequest) {
  const scope = await getAdminScope(request);
  if (!scope.ok) return jsonError(scope.error, scope.status);

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("report_subscriptions")
    .select("id,user_id,report_type,email,active,created_at")
    .eq("hotel_id", scope.hotelId)
    .order("created_at", { ascending: false });

  if (error) return jsonDbError(error);

  return NextResponse.json({ ok: true, subscriptions: data ?? [] });
}

export async function POST(request: NextRequest) {
  const scope = await getAdminScope(request);
  if (!scope.ok) return jsonError(scope.error, scope.status);

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const reportType = body?.report_type === "monthly" ? "monthly" : "weekly";

  if (!email || !email.includes("@")) {
    return jsonError("Email inválido.", 400);
  }

  const admin = supabaseAdmin();

  // Find user by email (optional — allow external emails too)
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .eq("hotel_id", scope.hotelId)
    .maybeSingle();

  const userId = profile?.id ?? scope.caller.profile.id;

  const { data, error } = await admin
    .from("report_subscriptions")
    .upsert(
      {
        hotel_id: scope.hotelId,
        user_id: userId,
        report_type: reportType,
        email,
        active: true,
      },
      { onConflict: "hotel_id,user_id,report_type" }
    )
    .select("id,user_id,report_type,email,active,created_at")
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
