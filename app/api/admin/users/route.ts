import { NextRequest, NextResponse } from "next/server";

import { authorizeRouteRequest, resolveRouteHotelScope } from "@/lib/auth/server";
import { createManagedUser, listManagedUsers } from "@/lib/auth/userManagement";
import { jsonError , jsonDbError } from "@/lib/api/response";
import { canAddUser } from "@/lib/billing/enforcement";
import { logAdminAction } from "@/lib/admin/auditLog";

export async function GET(request: NextRequest) {
  try {
    const caller = await authorizeRouteRequest(request, { roles: ["admin", "superadmin"] });
    if (!caller) return jsonError("No autorizado.", 401);

    const result = await listManagedUsers(caller.profile);
    if (!result.ok) {
      return jsonError(result.error, result.status);
    }

    return NextResponse.json({
      ok: true,
      hotel_id: result.hotelId,
      users: result.users,
    });
  } catch (error) {
    return jsonDbError(error instanceof Error ? { message: error.message } : null, "Error inesperado.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const caller = await authorizeRouteRequest(request, { roles: ["admin", "superadmin"] });
    if (!caller) return jsonError("No autorizado.", 401);

    // Plan enforcement: check user limit
    const hotelResult = resolveRouteHotelScope(caller.profile, null);
    if (hotelResult.ok) {
      const userCheck = await canAddUser(caller.profile.id, hotelResult.hotelId);
      if (!userCheck.allowed) {
        return jsonError(userCheck.reason, 403);
      }
    }

    const body = await request.json().catch(() => null);
    const result = await createManagedUser(caller.profile, body ?? {});
    if (!result.ok) {
      return jsonError(result.error, result.status);
    }

    if (hotelResult.ok) {
      void logAdminAction({
        hotelId: hotelResult.hotelId,
        actorId: caller.profile.id,
        actorName: caller.profile.full_name ?? caller.profile.id,
        targetId: result.userId,
        targetName: typeof body?.full_name === "string" ? body.full_name.trim() || null : (body?.email ?? null),
        action: "user_created",
        newValue: typeof body?.role === "string" ? body.role : undefined,
      });
    }

    return NextResponse.json({
      ok: true,
      user_id: result.userId,
    });
  } catch (error) {
    return jsonDbError(error instanceof Error ? { message: error.message } : null, "Error inesperado.");
  }
}
