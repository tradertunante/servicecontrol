import { NextRequest, NextResponse } from "next/server";

import { authorizeRouteRequest } from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  assertRoleAssignable,
  canManageExistingUser,
  deleteManagedUser,
  loadManagedUser,
  resolveManagedHotelId,
} from "@/lib/auth/userManagement";
import { jsonError, jsonDbError } from "@/lib/api/response";
import { parseUUID, isErrorResponse } from "@/lib/api/validate";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const caller = await authorizeRouteRequest(request, { roles: ["admin", "superadmin"] });
    if (!caller) return jsonError("No autorizado.", 401);

    const hotelResult = resolveManagedHotelId(caller.profile);
    if (!hotelResult.ok) return jsonError(hotelResult.error, hotelResult.status);

    const userId = parseUUID(params.id, "user_id");
    if (isErrorResponse(userId)) return userId;

    const user = await loadManagedUser(userId, hotelResult.hotelId);
    if (!user) return jsonError("Usuario no encontrado.", 404);

    if (!canManageExistingUser(caller.profile.role, user.role)) {
      return jsonError("No puedes administrar este usuario.", 403);
    }

    return NextResponse.json({ ok: true, user });
  } catch (error) {
    return jsonDbError(error instanceof Error ? { message: error.message } : null, "Error inesperado.");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const caller = await authorizeRouteRequest(request, { roles: ["admin", "superadmin"] });
    if (!caller) return jsonError("No autorizado.", 401);

    const body = await request.json().catch(() => null);
    const hotelResult = resolveManagedHotelId(caller.profile);
    if (!hotelResult.ok) return jsonError(hotelResult.error, hotelResult.status);

    const userId = parseUUID(params.id, "user_id");
    if (isErrorResponse(userId)) return userId;

    const target = await loadManagedUser(userId, hotelResult.hotelId);
    if (!target) return jsonError("Usuario no encontrado.", 404);

    if (!canManageExistingUser(caller.profile.role, target.role)) {
      return jsonError("No puedes administrar este usuario.", 403);
    }

    const requestedRole = body?.role ?? target.role;
    const roleResult =
      caller.profile.role === "superadmin" && target.role === "superadmin" && requestedRole === "superadmin"
        ? { ok: true as const, role: target.role }
        : assertRoleAssignable(caller.profile.role, requestedRole);
    if (!roleResult.ok) return jsonError(roleResult.error, roleResult.status);

    if (userId === caller.profile.id && body?.active === false) {
      return jsonError("No puedes desactivarte a ti mismo.", 400);
    }

    const fullName =
      typeof body?.full_name === "string" ? body.full_name.trim() || null : target.full_name;
    const active = body?.active !== false;

    const admin = supabaseAdmin();
    const { error } = await admin
      .from("profiles")
      .update({
        full_name: fullName,
        role: roleResult.role,
        active,
      })
      .eq("id", userId)
      .eq("hotel_id", hotelResult.hotelId);

    if (error) return jsonDbError(error);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonDbError(error instanceof Error ? { message: error.message } : null, "Error inesperado.");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const caller = await authorizeRouteRequest(request, { roles: ["admin", "superadmin"] });
    if (!caller) return jsonError("No autorizado.", 401);

    const userId = parseUUID(params.id, "user_id");
    if (isErrorResponse(userId)) return userId;

    const result = await deleteManagedUser(caller.profile, userId);
    if (!result.ok) return jsonError(result.error, result.status);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonDbError(error instanceof Error ? { message: error.message } : null, "Error inesperado.");
  }
}
