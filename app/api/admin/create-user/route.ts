// app/api/admin/create-user/route.ts

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authorizeRouteRequest } from "@/lib/auth/server";
import {
  assertRoleAssignable,
  resolveManagedHotelId,
} from "@/lib/auth/userManagement";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: NextRequest) {
  try {
    const caller = await authorizeRouteRequest(req, { roles: ["admin", "superadmin"] });
    if (!caller) return jsonError("No autorizado.", 401);

    const body = await req.json();

    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const full_name = body.full_name ?? null;
    const hotelResult = resolveManagedHotelId(
      caller.profile,
      String(body.hotel_id ?? "").trim() || null
    );

    if (!email || !password) {
      return jsonError("Email y password son obligatorios.");
    }

    if (!hotelResult.ok) {
      return jsonError(hotelResult.error, hotelResult.status);
    }

    const roleResult = assertRoleAssignable(caller.profile.role, body.role);
    if (!roleResult.ok) {
      return jsonError(roleResult.error, roleResult.status);
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
        role: roleResult.role,
        hotel_id: hotelResult.hotelId,
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
