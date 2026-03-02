// app/api/admin/user-area-access/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseWithToken } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type CallerRole = "admin" | "manager" | "auditor" | "superadmin";

export async function POST(req: NextRequest) {
  const reqId = Math.random().toString(16).slice(2, 8);

  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return NextResponse.json({ error: "No autorizado (falta token)." }, { status: 401 });

    const body = await req.json().catch(() => null);
    const user_id = String(body?.user_id ?? "");
    const hotel_id = String(body?.hotel_id ?? "");

    if (!user_id) return NextResponse.json({ error: "Falta user_id." }, { status: 400 });
    if (!hotel_id) return NextResponse.json({ error: "Falta hotel_id." }, { status: 400 });

    const client = supabaseWithToken(token);

    const { data: userData, error: userErr } = await client.auth.getUser(token);
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: "No autorizado (sesión inválida)." }, { status: 401 });
    }

    const { data: callerProfile, error: profErr } = await client
      .from("profiles")
      .select("id, hotel_id, role, active")
      .eq("id", userData.user.id)
      .single();

    if (profErr || !callerProfile) return NextResponse.json({ error: "No se pudo validar tu perfil." }, { status: 403 });
    if (callerProfile.active === false) return NextResponse.json({ error: "Usuario desactivado." }, { status: 403 });

    const callerRole = String(callerProfile.role ?? "") as CallerRole;
    if (!["admin", "superadmin"].includes(callerRole)) {
      return NextResponse.json({ error: "Forbidden: solo admin/superadmin." }, { status: 403 });
    }

    if (callerRole === "admin" && callerProfile.hotel_id && String(callerProfile.hotel_id) !== hotel_id) {
      return NextResponse.json({ error: "Forbidden: hotel no coincide con tu perfil." }, { status: 403 });
    }

    const admin = supabaseAdmin();

    const { data: rows, error: rowsErr } = await admin
      .from("user_area_access")
      .select("area_id")
      .eq("hotel_id", hotel_id)
      .eq("user_id", user_id);

    if (rowsErr) {
      console.error(`[uaa:${reqId}]`, rowsErr.message);
      return NextResponse.json({ error: rowsErr.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      area_ids: (rows ?? []).map((r: any) => r.area_id).filter(Boolean),
    });
  } catch (e: any) {
    console.error(`[uaa:${reqId}] Unexpected`, e?.message);
    return NextResponse.json({ error: e?.message ?? "Error inesperado." }, { status: 500 });
  }
}