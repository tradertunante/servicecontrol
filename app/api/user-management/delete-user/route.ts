// app/api/user-management/delete-user/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "@/lib/config";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Role = "admin" | "manager" | "auditor" | "superadmin";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return NextResponse.json({ ok: false, error: "No autorizado (sin token)." }, { status: 401 });

    const client = createClient(supabaseConfig.url, supabaseConfig.anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });

    const { data: callerAuth } = await client.auth.getUser(token);
    if (!callerAuth?.user) return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });

    const callerId = callerAuth.user.id;

    const { data: callerProfile, error: callerErr } = await client
      .from("profiles")
      .select("id, hotel_id, role, active")
      .eq("id", callerId)
      .single();

    if (callerErr || !callerProfile) {
      return NextResponse.json({ ok: false, error: "No se pudo validar tu perfil." }, { status: 403 });
    }

    const callerRole = callerProfile.role as Role;
    if (!callerProfile.active || !(callerRole === "admin" || callerRole === "superadmin")) {
      return NextResponse.json({ ok: false, error: "Forbidden: solo admin/superadmin." }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const targetUserId = String(body?.user_id || "");
    const hotelId = String(body?.hotel_id || "");

    if (!targetUserId) return NextResponse.json({ ok: false, error: "Falta user_id." }, { status: 400 });
    if (!hotelId) return NextResponse.json({ ok: false, error: "Falta hotel_id." }, { status: 400 });

    if (targetUserId === callerId) {
      return NextResponse.json({ ok: false, error: "No puedes borrarte a ti misma." }, { status: 400 });
    }

    if (callerRole !== "superadmin" && hotelId !== String(callerProfile.hotel_id)) {
      return NextResponse.json({ ok: false, error: "Forbidden: hotel incorrecto." }, { status: 403 });
    }

    const admin = supabaseAdmin();

    const { data: targetProfile, error: targetErr } = await admin
      .from("profiles")
      .select("id, hotel_id, role")
      .eq("id", targetUserId)
      .single();

    if (targetErr || !targetProfile) {
      return NextResponse.json({ ok: false, error: "No se encontró el usuario." }, { status: 404 });
    }

    if (String(targetProfile.hotel_id) !== hotelId) {
      return NextResponse.json({ ok: false, error: "Forbidden: usuario de otro hotel." }, { status: 403 });
    }

    if (callerRole !== "superadmin" && targetProfile.role === "superadmin") {
      return NextResponse.json({ ok: false, error: "Forbidden: no puedes borrar un superadmin." }, { status: 403 });
    }

    await admin.from("user_area_access").delete().eq("user_id", targetUserId);
    await admin.from("profiles").delete().eq("id", targetUserId);

    const { error: delAuthErr } = await admin.auth.admin.deleteUser(targetUserId);
    if (delAuthErr) {
      return NextResponse.json({ ok: false, error: delAuthErr.message ?? "No se pudo borrar el usuario (Auth)." }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error inesperado." }, { status: 500 });
  }
}