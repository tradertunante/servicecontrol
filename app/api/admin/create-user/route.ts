import { NextRequest, NextResponse } from "next/server";
import { supabaseWithToken } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Role = "admin" | "manager" | "auditor" | "quality";
type CallerRole = "admin" | "manager" | "auditor" | "quality" | "superadmin";

function isUuidLike(x: any) {
  const s = String(x ?? "");
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

export async function POST(req: NextRequest) {
  const reqId = Math.random().toString(16).slice(2, 8);

  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return NextResponse.json({ error: "No autorizado (falta token)." }, { status: 401 });

    const client = supabaseWithToken(token);
    const { data: userData, error: userErr } = await client.auth.getUser(token);
    if (userErr || !userData?.user) return NextResponse.json({ error: "No autorizado (sesión inválida)." }, { status: 401 });

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

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Body inválido." }, { status: 400 });

    const full_name = body.full_name ? String(body.full_name).trim() : null;
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const role = String(body.role ?? "auditor") as Role;
    const requestedHotelId = body.hotel_id ? String(body.hotel_id).trim() : null;

    if (!email) return NextResponse.json({ error: "Email es obligatorio." }, { status: 400 });
    if (!password || password.length < 8) return NextResponse.json({ error: "Password mínimo 8 caracteres." }, { status: 400 });

    // ✅ quality incluido como rol válido
    if (!["admin", "manager", "auditor", "quality"].includes(role)) {
      return NextResponse.json({ error: "Rol inválido." }, { status: 400 });
    }

    let targetHotelId: string | null = null;
    if (callerRole === "admin") {
      targetHotelId = callerProfile.hotel_id ?? null;
      if (!targetHotelId) return NextResponse.json({ error: "Tu usuario admin no tiene hotel asignado." }, { status: 400 });
    } else {
      if (!requestedHotelId || !isUuidLike(requestedHotelId)) {
        return NextResponse.json({ error: "Como superadmin, debes seleccionar un hotel antes de crear usuarios." }, { status: 400 });
      }
      targetHotelId = requestedHotelId;
    }

    const admin = supabaseAdmin();

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: full_name ? { full_name } : {},
    });

    if (createErr || !created?.user) {
      const msg =
        createErr?.message?.toLowerCase().includes("already registered") ||
        createErr?.message?.toLowerCase().includes("already exists")
          ? "Ese email ya existe en Auth."
          : createErr?.message ?? "No se pudo crear el usuario en Auth.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const newUserId = created.user.id;

    const { error: upsertErr } = await admin.from("profiles").upsert(
      { id: newUserId, hotel_id: targetHotelId, role, active: true, full_name },
      { onConflict: "id" }
    );

    if (upsertErr) {
      await admin.auth.admin.deleteUser(newUserId);
      return NextResponse.json({ error: upsertErr.message ?? "No se pudo crear el profile." }, { status: 400 });
    }

    return NextResponse.json({ ok: true, user_id: newUserId });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error inesperado." }, { status: 500 });
  }
}