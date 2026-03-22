import { NextRequest, NextResponse } from "next/server";

import { authorizeRouteRequest, resolveRouteHotelScope } from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { jsonError, jsonDbError } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  const caller = await authorizeRouteRequest(request);
  if (!caller) return jsonError("No autorizado.", 401);

  const hotelResult = resolveRouteHotelScope(caller.profile, null);
  if (!hotelResult.ok) return jsonError(hotelResult.error, hotelResult.status);

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("notifications")
    .select("id,type,title,body,link,read_at,created_at")
    .eq("user_id", caller.profile.id)
    .eq("hotel_id", hotelResult.hotelId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return jsonDbError(error);

  const unreadCount = (data ?? []).filter((n) => !n.read_at).length;

  return NextResponse.json({ ok: true, notifications: data ?? [], unreadCount });
}

export async function PATCH(request: NextRequest) {
  const caller = await authorizeRouteRequest(request);
  if (!caller) return jsonError("No autorizado.", 401);

  const body = await request.json().catch(() => null);
  const ids = Array.isArray(body?.ids) ? body.ids.filter((id: unknown) => typeof id === "string") : [];

  if (ids.length === 0) return jsonError("ids es obligatorio.", 400);

  const admin = supabaseAdmin();
  const { error } = await admin
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .in("id", ids)
    .eq("user_id", caller.profile.id)
    .is("read_at", null);

  if (error) return jsonDbError(error);

  return NextResponse.json({ ok: true });
}
