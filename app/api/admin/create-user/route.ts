// app/api/admin/create-user/route.ts

import { NextRequest, NextResponse } from "next/server";
import { supabaseWithToken } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Role =
  | "admin"
  | "manager"
  | "auditor"
  | "quality"
  | "engineering"
  | "systems"
  | "superadmin";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

const allowedRoles: Role[] = [
  "admin",
  "manager",
  "auditor",
  "quality",
  "engineering",
  "systems",
  "superadmin",
];

function normalizeRole(input: unknown): Role {
  const role = String(input ?? "").trim().toLowerCase();

  if (allowedRoles.includes(role as Role)) {
    return role as Role;
  }

  return "auditor";
}

async function getCaller(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) {
    return { ok: false as const, error: "No autorizado.", status: 401 };
  }

  const client = supabaseWithToken(token);

  const { data: callerAuth } = await client.auth.getUser(token);
  if (!callerAuth?.user) {
    return { ok: false as const, error: "No autorizado.", status: 401 };
  }

  const callerId = callerAuth.user.id;

  const { data: callerProfile, error } = await client
    .from("profiles")
    .select("id, hotel_id, role, active")
    .eq("id", callerId)
    .single();

  if (error || !callerProfile) {
    return { ok: false as const, error: "Perfil inválido.", status: 403 };
  }

  const role = normalizeRole(callerProfile.role);

  if (!(callerProfile.active ?? true) || (role !== "admin" && role !== "superadmin")) {
    return { ok: false as const, error: "Forbidden.", status: 403 };
  }

  return {
    ok: true as const,
    callerProfile,
  };
}

export async function POST(req: NextRequest) {
  try {
    const caller = await getCaller(req);
    if (!caller.ok) return jsonError(caller.error, caller.status);

    const body = await req.json();

    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const full_name = body.full_name ?? null;
    const role = normalizeRole(body.role);
    const hotel_id = body.hotel_id;

    if (!email || !password) {
      return jsonError("Email y password son obligatorios.");
    }

    if (!hotel_id) {
      return jsonError("hotel_id es obligatorio.");
    }

    const admin = supabaseAdmin();

    // crear usuario en auth
    const { data: authUser, error: authErr } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (authErr) return jsonError(authErr.message, 500);

    const userId = authUser.user.id;

    // crear perfil
    const { error: profileErr } = await admin
      .from("profiles")
      .insert({
        id: userId,
        email,
        full_name,
        role,
        hotel_id,
        active: true,
      });

    if (profileErr) {
      return jsonError(profileErr.message, 500);
    }

    return NextResponse.json({
      ok: true,
      user_id: userId,
    });
  } catch (e: any) {
    return jsonError(e?.message ?? "Error inesperado.", 500);
  }
}