import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "@/lib/config";

type Role = "admin" | "manager" | "auditor";

export async function POST(req: NextRequest) {
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

    if (!token) {
      return NextResponse.json({ error: "No autorizado (falta token)." }, { status: 401 });
    }

    // Cliente con ANON para validar quién llama (con su token)
    const client = createClient(supabaseConfig.url, supabaseConfig.anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });

    const { data: userData, error: userErr } = await client.auth.getUser(token);
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: "No autorizado (sesión inválida)." }, { status: 401 });
    }

    // Debe ser admin (leemos su profile)
    const { data: callerProfile, error: profErr } = await client
      .from("profiles")
      .select("id, hotel_id, role, active")
      .eq("id", userData.user.id)
      .single();

    if (profErr || !callerProfile) {
      return NextResponse.json({ error: "No se pudo validar tu perfil." }, { status: 403 });
    }

    if (!callerProfile.active || callerProfile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: solo admin." }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Body inválido." }, { status: 400 });
    }

    const full_name = (body.full_name ?? null) as string | null;
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const role = String(body.role ?? "auditor") as Role;

    if (!email) return NextResponse.json({ error: "Email es obligatorio." }, { status: 400 });
    if (!password || password.length < 8) {
      return NextResponse.json({ error: "Password mínimo 8 caracteres." }, { status: 400 });
    }
    if (!["admin", "manager", "auditor"].includes(role)) {
      return NextResponse.json({ error: "Rol inválido." }, { status: 400 });
    }

    // Cliente ADMIN (service role) para crear usuario y escribir perfiles sin RLS
    const admin = createClient(supabaseConfig.url, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // 1) Crear usuario en Auth
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // lo deja listo sin que confirme email
      user_metadata: full_name ? { full_name } : {},
    });

    if (createErr || !created?.user) {
      return NextResponse.json(
        { error: createErr?.message ?? "No se pudo crear el usuario en Auth." },
        { status: 400 }
      );
    }

    const newUserId = created.user.id;

    // 2) Crear/actualizar profile en el mismo hotel del admin
    const { error: upsertErr } = await admin.from("profiles").upsert(
      {
        id: newUserId,
        hotel_id: callerProfile.hotel_id,
        role,
        active: true,
        full_name,
      },
      { onConflict: "id" }
    );

    if (upsertErr) {
      // Si falla profile, intentamos borrar el usuario creado para no dejar basura
      await admin.auth.admin.deleteUser(newUserId);
      return NextResponse.json(
        { error: upsertErr.message ?? "No se pudo crear el profile." },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, user_id: newUserId });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Error inesperado." },
      { status: 500 }
    );
  }
}
