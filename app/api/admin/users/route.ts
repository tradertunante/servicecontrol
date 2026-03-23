import { NextRequest, NextResponse } from "next/server";

import { authorizeRouteRequest } from "@/lib/auth/server";
import { createManagedUser, listManagedUsers } from "@/lib/auth/userManagement";
import { jsonError , jsonDbError } from "@/lib/api/response";

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

    const body = await request.json().catch(() => null);
    const result = await createManagedUser(caller.profile, body ?? {});
    if (!result.ok) {
      return jsonError(result.error, result.status);
    }

    return NextResponse.json({
      ok: true,
      user_id: result.userId,
    });
  } catch (error) {
    return jsonDbError(error instanceof Error ? { message: error.message } : null, "Error inesperado.");
  }
}
