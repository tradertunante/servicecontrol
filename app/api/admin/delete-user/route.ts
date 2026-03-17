// app/api/admin/delete-user/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authorizeRouteRequest } from "@/lib/auth/server";
import { resolveManagedUserAccess } from "@/lib/auth/userManagement";

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

    const targetScope = await resolveManagedUserAccess(caller.profile, targetUserId);
    if (!targetScope.ok) {
      return NextResponse.json({ error: targetScope.error }, { status: targetScope.status });
    }

    const hotelId = targetScope.hotelId;

    const admin = supabaseAdmin();

    await admin
      .from("user_area_access")
      .delete()
      .eq("user_id", targetUserId)
      .eq("hotel_id", hotelId);

    await admin
      .from("profiles")
      .delete()
      .eq("id", targetUserId)
      .eq("hotel_id", hotelId);

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
