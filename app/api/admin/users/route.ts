import { NextRequest, NextResponse } from "next/server";

import { authorizeRouteRequest } from "@/lib/auth/server";
import { createManagedUser, listManagedUsers } from "@/lib/auth/userManagement";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

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
    return jsonError(error instanceof Error ? error.message : "Error inesperado.", 500);
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
    return jsonError(error instanceof Error ? error.message : "Error inesperado.", 500);
  }
}
