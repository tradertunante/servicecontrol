// app/api/admin/user-area-access/get/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authorizeRouteRequest } from "@/lib/auth/server";
import { resolveManagedUserAccess } from "@/lib/auth/userManagement";

export async function POST(req: NextRequest) {
  const reqId = Math.random().toString(16).slice(2, 8);

  try {
    const caller = await authorizeRouteRequest(req, { roles: ["admin", "superadmin"] });
    if (!caller) return NextResponse.json({ error: "No autorizado (falta token)." }, { status: 401 });

    const body = await req.json().catch(() => null);
    const user_id = String(body?.user_id ?? "");

    if (!user_id) return NextResponse.json({ error: "Falta user_id." }, { status: 400 });
    const targetScope = await resolveManagedUserAccess(caller.profile, user_id);
    if (!targetScope.ok) {
      return NextResponse.json({ error: targetScope.error }, { status: targetScope.status });
    }

    const admin = supabaseAdmin();

    const { data: rows, error: rowsErr } = await admin
      .from("user_area_access")
      .select("area_id")
      .eq("hotel_id", targetScope.hotelId)
      .eq("user_id", user_id);

    if (rowsErr) {
      console.error(`[uaa-get:${reqId}]`, rowsErr.message);
      return NextResponse.json({ error: rowsErr.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      area_ids: (rows ?? []).map((r: any) => r.area_id).filter(Boolean),
    });
  } catch (e: any) {
    console.error(`[uaa-get:${reqId}] Unexpected`, e?.message);
    return NextResponse.json({ error: e?.message ?? "Error inesperado." }, { status: 500 });
  }
}
