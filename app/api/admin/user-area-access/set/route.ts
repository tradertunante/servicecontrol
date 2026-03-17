// app/api/admin/user-area-access/set/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authorizeRouteRequest, resolveRouteHotelScope } from "@/lib/auth/server";

export async function POST(req: NextRequest) {
  const reqId = Math.random().toString(16).slice(2, 8);

  try {
    const caller = await authorizeRouteRequest(req, { roles: ["admin", "superadmin"] });
    if (!caller) return NextResponse.json({ error: "No autorizado (falta token)." }, { status: 401 });

    const body = await req.json().catch(() => null);
    const user_id = String(body?.user_id ?? "");
    const area_ids_raw = Array.isArray(body?.area_ids) ? body.area_ids : [];
    const area_ids = area_ids_raw.map((x: any) => String(x)).filter(Boolean);

    if (!user_id) return NextResponse.json({ error: "Falta user_id." }, { status: 400 });
    const hotelResult = resolveRouteHotelScope(caller.profile, null);
    if (!hotelResult.ok) return NextResponse.json({ error: hotelResult.error }, { status: hotelResult.status });

    const admin = supabaseAdmin();

    const { data: targetUser, error: targetUserErr } = await admin
      .from("profiles")
      .select("id, hotel_id")
      .eq("id", user_id)
      .maybeSingle();

    if (targetUserErr) return NextResponse.json({ error: targetUserErr.message }, { status: 400 });
    if (!targetUser?.id || String(targetUser.hotel_id ?? "") !== hotelResult.hotelId) {
      return NextResponse.json({ error: "El usuario no pertenece al hotel activo." }, { status: 404 });
    }

    // Validar que las áreas pertenecen al hotel
    if (area_ids.length > 0) {
      const { data: okAreas, error: areasErr } = await admin
        .from("areas")
        .select("id")
        .eq("hotel_id", hotelResult.hotelId)
        .in("id", area_ids);

      if (areasErr) return NextResponse.json({ error: areasErr.message }, { status: 400 });

      const okSet = new Set((okAreas ?? []).map((a: any) => a.id));
      const invalid = area_ids.filter((id: string) => !okSet.has(id));
      if (invalid.length) {
        return NextResponse.json({ error: "Hay áreas que no pertenecen al hotel seleccionado." }, { status: 400 });
      }
    }

    // Reemplazar accesos (delete + insert)
    const { error: delErr } = await admin
      .from("user_area_access")
      .delete()
      .eq("hotel_id", hotelResult.hotelId)
      .eq("user_id", user_id);

    if (delErr) {
      console.error(`[uaa-set:${reqId}] delete`, delErr.message);
      return NextResponse.json({ error: delErr.message }, { status: 400 });
    }

    if (area_ids.length > 0) {
      const payload = area_ids.map((area_id: string) => ({
        user_id,
        area_id,
        hotel_id: hotelResult.hotelId,
      }));
      const { error: insErr } = await admin.from("user_area_access").insert(payload);
      if (insErr) {
        console.error(`[uaa-set:${reqId}] insert`, insErr.message);
        return NextResponse.json({ error: insErr.message }, { status: 400 });
      }
    }

    return NextResponse.json({ ok: true, count: area_ids.length });
  } catch (e: any) {
    console.error(`[uaa-set:${reqId}] Unexpected`, e?.message);
    return NextResponse.json({ error: e?.message ?? "Error inesperado." }, { status: 500 });
  }
}
