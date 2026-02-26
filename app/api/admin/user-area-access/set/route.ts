// app/api/admin/user-area-access/set/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "@/lib/config";

type CallerRole = "admin" | "manager" | "auditor" | "superadmin";

export async function POST(req: NextRequest) {
  const reqId = Math.random().toString(16).slice(2, 8);

  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "Falta SUPABASE_SERVICE_ROLE_KEY en variables de entorno (server-only)." },
        { status: 500 }
      );
    }

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return NextResponse.json({ error: "No autorizado (falta token)." }, { status: 401 });

    const body = await req.json().catch(() => null);
    const user_id = String(body?.user_id ?? "");
    const hotel_id = String(body?.hotel_id ?? "");
    const area_ids_raw = Array.isArray(body?.area_ids) ? body.area_ids : [];

    const area_ids = area_ids_raw.map((x: any) => String(x)).filter(Boolean);

    if (!user_id) return NextResponse.json({ error: "Falta user_id." }, { status: 400 });
    if (!hotel_id) return NextResponse.json({ error: "Falta hotel_id." }, { status: 400 });

    // Validar caller
    const client = createClient(supabaseConfig.url, supabaseConfig.anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });

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

    const admin = createClient(supabaseConfig.url, serviceRoleKey, { auth: { persistSession: false } });

    // (Opcional pero recomendable) Validar que las áreas pertenecen al hotel
    if (area_ids.length > 0) {
      const { data: okAreas, error: areasErr } = await admin
        .from("areas")
        .select("id")
        .eq("hotel_id", hotel_id)
        .in("id", area_ids);

      if (areasErr) return NextResponse.json({ error: areasErr.message }, { status: 400 });

      const okSet = new Set((okAreas ?? []).map((a: any) => a.id));
      const invalid = area_ids.filter((id: string) => !okSet.has(id));
      if (invalid.length) {
        return NextResponse.json({ error: "Hay áreas que no pertenecen al hotel seleccionado." }, { status: 400 });
      }
    }

    // Reemplazar (delete + insert)
    const { error: delErr } = await admin
      .from("user_area_access")
      .delete()
      .eq("hotel_id", hotel_id)
      .eq("user_id", user_id);

    if (delErr) {
      console.error(`[uaa-set:${reqId}] delete`, delErr.message);
      return NextResponse.json({ error: delErr.message }, { status: 400 });
    }

    if (area_ids.length > 0) {
      const payload = area_ids.map((area_id: string) => ({
        user_id,
        area_id,
        hotel_id,
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