// app/api/admin/create-user/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "@/lib/config";

type Role = "admin" | "manager" | "auditor";
type CallerRole = "admin" | "manager" | "auditor" | "superadmin";

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
    if (!token) return NextResponse.json({ error: "No autorizado (falta token)." }, { status: 401 });

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

    if (profErr || !callerProfile) {
      return NextResponse.json({ error: "No se pudo validar tu perfil." }, { status: 403 });
    }

    if (callerProfile.active === false) {
      return NextResponse.json({ error: "Usuario desactivado." }, { status: 403 });
    }

    const callerRole = String(callerProfile.role ?? "") as CallerRole;
    if (!["admin", "superadmin"].includes(callerRole)) {
      return NextResponse.json({ error: "Forbidden: solo admin/superadmin." }, { status: 403 });
    }

    if (!callerProfile.hotel_id) {
      return NextResponse.json(
        { error: "No hay hotel seleccionado. Selecciona un hotel primero." },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Body inválido." }, { status: 400 });
    }

    const full_name = body.full_name ? String(body.full_name).trim() : null;
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

    const admin = createClient(supabaseConfig.url, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm