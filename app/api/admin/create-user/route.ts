// app/api/admin/create-user/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "@/lib/config";

type Role = "admin" | "manager" | "auditor";
type CallerRole = "admin" | "manager" | "auditor" | "superadmin";

function projectRefFromUrl(url: string) {
  try {
    const u = new URL(url);
    const host = u.hostname;
    return host.split(".")[0] || host;
  } catch {
    return "unknown";
  }
}

function isUuidLike(x: any) {
  const s = String(x ?? "");
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

export async function POST(req: NextRequest) {
  const reqId = Math.random().toString(16).slice(2, 8);
  const projectRef = projectRefFromUrl(supabaseConfig.url);

  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    console.log(`[create-user:${reqId}] projectRef=${projectRef}`);

    if (!serviceRoleKey) {
      console.error(`[create-user:${reqId}] Missing SUPABASE_SERVICE_ROLE_KEY`);
      return NextResponse.json(
        { error: "Falta SUPABASE_SERVICE_ROLE_KEY en variables de entorno (server-only)." },
        { status: 500 }
      );
    }

    if (!serviceRoleKey.startsWith("eyJ")) {
      console.warn(
        `[create-user:${reqId}] SUPABASE_SERVICE_ROLE_KEY no parece JWT (¿key incorrecta o de otro proyecto?)`
      );
    }

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    if (!token) {
      console.warn(`[create-user:${reqId}] Missing Bearer token`);
      return NextResponse.json({ error: "No autorizado (falta token)." }, { status: 401 });
    }

    // Cliente ANON con token para validar caller
    const client = createClient(supabaseConfig.url, supabaseConfig.anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });

    const { data: userData, error: userErr } = await client.auth.getUser(token);
    if (userErr || !userData?.user) {
      console.warn(`[create-user:${reqId}] Invalid session`, userErr?.message);
      return NextResponse.json({ error: "No autorizado (sesión inválida)." }, { status: 401 });
    }

    // Perfil del caller
    const { data: callerProfile, error: profErr } = await client
      .from("profiles")
      .select("id, hotel_id, role, active")
      .eq("id", userData.user.id)
      .single();

    if (profErr || !callerProfile) {
      console.warn(`[create-user:${reqId}] Cannot read caller profile`, profErr?.message);
      return NextResponse.json({ error: "No se pudo validar tu perfil." }, { status: 403 });
    }

    if (callerProfile.active === false) {
      console.warn(`[create-user:${reqId}] Caller is inactive`);
      return NextResponse.json({ error: "Usuario desactivado." }, { status: 403 });
    }

    const callerRole = String(callerProfile.role ?? "") as CallerRole;
    if (!["admin", "superadmin"].includes(callerRole)) {
      console.warn(`[create-user:${reqId}] Forbidden role=${callerRole}`);
      return NextResponse.json({ error: "Forbidden: solo admin/superadmin." }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      console.warn(`[create-user:${reqId}] Invalid body`);
      return NextResponse.json({ error: "Body inválido." }, { status: 400 });
    }

    const full_name = body.full_name ? String(body.full_name).trim() : null;
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const role = String(body.role ?? "auditor") as Role;

    // ✅ hotel_id objetivo (para superadmin viene del body)
    const requestedHotelId = body.hotel_id ? String(body.hotel_id).trim() : null;

    if (!email) return NextResponse.json({ error: "Email es obligatorio." }, { status: 400 });
    if (!password || password.length < 8) {
      return NextResponse.json({ error: "Password mínimo 8 caracteres." }, { status: 400 });
    }
    if (!["admin", "manager", "auditor"].includes(role)) {
      return NextResponse.json({ error: "Rol inválido." }, { status: 400 });
    }

    // ✅ Decide hotel_id final
    let targetHotelId: string | null = null;

    if (callerRole === "admin") {
      // admin SOLO puede crear en su hotel
      targetHotelId = callerProfile.hotel_id ?? null;
      if (!targetHotelId) {
        console.warn(`[create-user:${reqId}] Admin missing caller hotel_id`);
        return NextResponse.json(
          { error: "Tu usuario admin no tiene hotel asignado (hotel_id). Revisa el profile." },
          { status: 400 }
        );
      }
    } else {
      // superadmin DEBE indicar hotel_id
      if (!requestedHotelId || !isUuidLike(requestedHotelId)) {
        console.warn(`[create-user:${reqId}] Superadmin missing/invalid hotel_id in body`);
        return NextResponse.json(
          { error: "Como superadmin, debes seleccionar un hotel antes de crear usuarios." },
          { status: 400 }
        );
      }
      targetHotelId = requestedHotelId;
    }

    // Cliente Service Role
    const admin = createClient(supabaseConfig.url, serviceRoleKey, {
      auth: { persistSession: false },
    });

    console.log(
      `[create-user:${reqId}] Creating user email=${email} role=${role} hotel_id=${targetHotelId} callerRole=${callerRole}`
    );

    // 1) Crear usuario Auth
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: full_name ? { full_name } : {},
    });

    if (createErr || !created?.user) {
      console.error(`[create-user:${reqId}] createUser failed`, createErr?.message);
      const msg =
        createErr?.message?.toLowerCase().includes("already registered") ||
        createErr?.message?.toLowerCase().includes("already exists")
          ? "Ese email ya existe en Auth."
          : createErr?.message ?? "No se pudo crear el usuario en Auth.";

      return NextResponse.json(
        { error: msg, debug: { projectRef, step: "createUser" } },
        { status: 400 }
      );
    }

    const newUserId = created.user.id;
    console.log(`[create-user:${reqId}] User created id=${newUserId}`);

    // 2) Upsert profile
    const { error: upsertErr } = await admin.from("profiles").upsert(
      {
        id: newUserId,
        hotel_id: targetHotelId, // ✅ aquí va el hotel objetivo
        role,
        active: true,
        full_name,
      },
      { onConflict: "id" }
    );

    if (upsertErr) {
      console.error(`[create-user:${reqId}] profile upsert failed`, upsertErr.message);
      await admin.auth.admin.deleteUser(newUserId);

      return NextResponse.json(
        { error: upsertErr.message ?? "No se pudo crear el profile.", debug: { projectRef, step: "upsertProfile" } },
        { status: 400 }
      );
    }

    console.log(`[create-user:${reqId}] OK`);
    return NextResponse.json({ ok: true, user_id: newUserId, debug: { projectRef } });
  } catch (e: any) {
    console.error(`[create-user:${reqId}] Unexpected error`, e?.message);
    return NextResponse.json(
      { error: e?.message ?? "Error inesperado.", debug: { projectRef, step: "catch" } },
      { status: 500 }
    );
  }
}