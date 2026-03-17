// app/api/admin/create-user/route.ts

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authorizeRouteRequest } from "@/lib/auth/server";

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

export async function POST(req: NextRequest) {
  try {
    const caller = await authorizeRouteRequest(req, { roles: ["admin", "superadmin"] });
    if (!caller) return jsonError("No autorizado.", 401);

    const body = await req.json();

    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const full_name = body.full_name ?? null;
    const role = normalizeRole(body.role);
    const hotel_id = String(body.hotel_id ?? "").trim();

    if (!email || !password) {
      return jsonError("Email y password son obligatorios.");
    }

    if (!hotel_id) {
      return jsonError("hotel_id es obligatorio.");
    }

    if (caller.profile.role !== "superadmin" && caller.profile.hotel_id !== hotel_id) {
      return jsonError("Forbidden.", 403);
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
