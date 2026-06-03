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
import { logAdminAction } from "@/lib/admin/auditLog";
import { sendRoleChangeEmail } from "@/lib/email/sendRoleChangeEmail";

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

    const newPassword = typeof body?.password === "string" ? body.password.trim() : null;
    if (newPassword !== null && newPassword.length < 8) {
      return jsonError("La contraseña debe tener al menos 8 caracteres.", 400);
    }

    const newEmail =
      caller.profile.role === "superadmin" && typeof body?.email === "string"
        ? body.email.trim().toLowerCase() || null
        : null;

    const admin = supabaseAdmin();
    const { error } = await admin
      .from("profiles")
      .update({
        full_name: fullName,
        role: roleResult.role,
        active,
        ...(newEmail ? { email: newEmail } : {}),
      })
      .eq("id", userId)
      .eq("hotel_id", hotelResult.hotelId);

    if (error) return jsonDbError(error);

    if (newPassword || newEmail) {
      const authUpdates: Parameters<typeof admin.auth.admin.updateUserById>[1] = {};
      if (newPassword) authUpdates.password = newPassword;
      if (newEmail) { authUpdates.email = newEmail; authUpdates.email_confirm = true; }
      const { error: authError } = await admin.auth.admin.updateUserById(userId, authUpdates);
      if (authError) return jsonDbError(authError);
    }

    const actorName = caller.profile.full_name ?? caller.profile.id;
    const targetName = target.full_name ?? target.email ?? userId;

    if (roleResult.role !== target.role) {
      void logAdminAction({
        hotelId: hotelResult.hotelId,
        actorId: caller.profile.id,
        actorName,
        targetId: userId,
        targetName,
        action: "role_changed",
        oldValue: target.role,
        newValue: roleResult.role,
      });

      if (target.email) {
        void (async () => {
          try {
            const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.servicecontrol.io";
            const { data: hotel } = await supabaseAdmin()
              .from("hotels")
              .select("name")
              .eq("id", hotelResult.hotelId)
              .single();
            await sendRoleChangeEmail({
              to: target.email!,
              userName: target.full_name,
              hotelName: hotel?.name ?? "Su hotel",
              oldRole: target.role,
              newRole: roleResult.role,
              loginUrl: `${appUrl}/login`,
            });
          } catch (err) {
            console.error("[role-change-email] Failed to send to", target.email, err);
          }
        })();
      }
    }
    if (active !== target.active) {
      void logAdminAction({
        hotelId: hotelResult.hotelId,
        actorId: caller.profile.id,
        actorName,
        targetId: userId,
        targetName,
        action: "active_changed",
        oldValue: String(target.active),
        newValue: String(active),
      });
    }

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

    const hotelResult = resolveManagedHotelId(caller.profile);
    const targetSnap = hotelResult.ok
      ? await loadManagedUser(userId, hotelResult.hotelId)
      : null;

    const result = await deleteManagedUser(caller.profile, userId);
    if (!result.ok) return jsonError(result.error, result.status);

    if (hotelResult.ok && targetSnap) {
      void logAdminAction({
        hotelId: hotelResult.hotelId,
        actorId: caller.profile.id,
        actorName: caller.profile.full_name ?? caller.profile.id,
        targetId: userId,
        targetName: targetSnap.full_name ?? targetSnap.email ?? userId,
        action: "user_deleted",
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonDbError(error instanceof Error ? { message: error.message } : null, "Error inesperado.");
  }
}
