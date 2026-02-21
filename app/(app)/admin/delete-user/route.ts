import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "@/lib/config";

export async function POST(req: NextRequest) {
  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "Falta SUPABASE_SERVICE_ROLE_KEY (server-only)." },
        { status: 500 }
      );
    }

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return NextResponse.json({ error: "No autorizado (sin token)." }, { status: 401 });

    // Cliente con anon + token para validar quién llama
    const client = createClient(supabaseConfig.url, supabaseConfig.anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });

    const { data: callerAuth } = await client.auth.getUser(token);
    if (!callerAuth?.user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

    const callerId = callerAuth.user.id;

    // Perfil del que llama
    const { data: callerProfile, error: callerErr } = await client
      .from("profiles")
      .select("id, hotel_id, role, active")
      .eq("id", callerId)
      .single();

    if (callerErr || !callerProfile) {
      return NextResponse.json({ error: "No se pudo validar tu perfil." }, { status: 403 });
    }

    if (!callerProfile.active || callerProfile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: solo admin." }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Body inválido." }, { status: 400 });

    const targetUserId = String(body.user_id || "");
    if (!targetUserId) return NextResponse.json({ error: "Falta user_id." }, { status: 400 });

    // No permitir borrarte a ti misma
    if (targetUserId === callerId) {
      return NextResponse.json({ error: "No puedes borrarte a ti mismo." }, { status: 400 });
    }

    // Verificar que el usuario objetivo es del mismo hotel
    const { data: targetProfile, error: targetErr } = await client
      .from("profiles")
      .select("id, hotel_id")
      .eq("id", targetUserId)
      .single();

    if (targetErr || !targetProfile) {
      return NextResponse.json({ error: "No se encontró el usuario." }, { status: 404 });
    }

    if (targetProfile.hotel_id !== callerProfile.hotel_id) {
      return NextResponse.json({ error: "Forbidden: usuario de otro hotel." }, { status: 403 });
    }

    // Admin client
    const admin = createClient(supabaseConfig.url, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // (Opcional) limpieza explícita por si no tienes cascades
    // Borra accesos
    await admin
      .from("user_area_access")
      .delete()
      .eq("user_id", targetUserId)
      .eq("hotel_id", callerProfile.hotel_id);

    // Borra profile
    await admin.from("profiles").delete().eq("id", targetUserId);

    // Borra Auth user (esto es lo importante)
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
