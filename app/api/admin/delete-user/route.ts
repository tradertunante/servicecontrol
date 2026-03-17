// app/api/admin/delete-user/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authorizeRouteRequest, resolveRouteHotelScope } from "@/lib/auth/server";

export async function POST(req: NextRequest) {
  try {
    const caller = await authorizeRouteRequest(req, { roles: ["admin", "superadmin"] });
    if (!caller) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Body inválido." }, { status: 400 });

    const targetUserId = String(body.user_id || "");
    if (!targetUserId) return NextResponse.json({ error: "Falta user_id." }, { status: 400 });

    if (targetUserId === caller.profile.id) {
      return NextResponse.json({ error: "No puedes borrarte a ti mismo." }, { status: 400 });
    }

    const hotelResult = resolveRouteHotelScope(caller.profile, null);
    if (!hotelResult.ok) {
      return NextResponse.json({ error: hotelResult.error }, { status: hotelResult.status });
    }

    // Verificar que el usuario objetivo es del mismo hotel
    const { data: targetProfile, error: targetErr } = await supabaseAdmin()
      .from("profiles")
      .select("id, hotel_id")
      .eq("id", targetUserId)
      .single();

    if (targetErr || !targetProfile) {
      return NextResponse.json({ error: "No se encontró el usuario." }, { status: 404 });
    }

    if (String(targetProfile.hotel_id ?? "") !== hotelResult.hotelId) {
      return NextResponse.json({ error: "Forbidden: usuario de otro hotel." }, { status: 403 });
    }

    const admin = supabaseAdmin();

    await admin
      .from("user_area_access")
      .delete()
      .eq("user_id", targetUserId)
      .eq("hotel_id", hotelResult.hotelId);

    await admin
      .from("profiles")
      .delete()
      .eq("id", targetUserId)
      .eq("hotel_id", hotelResult.hotelId);

    const { error: delAuthErr } = await admin.auth.admin.deleteUser(targetUserId);
    if (delAuthErr) {
      return NextResponse.json(
        { error: delAuthErr.message ?? "No se pudo borrar el usuario de Auth." },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error inesperado." }, { status: 500 });
  }
}
