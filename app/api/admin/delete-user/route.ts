import { NextRequest, NextResponse } from "next/server";

import { authorizeRouteRequest } from "@/lib/auth/server";
import { deleteManagedUser } from "@/lib/auth/userManagement";
import { jsonError , jsonDbError } from "@/lib/api/response";

export async function POST(request: NextRequest) {
  try {
    const caller = await authorizeRouteRequest(request, { roles: ["admin", "superadmin"] });
    if (!caller) return jsonError("No autorizado.", 401);

    const body = await request.json().catch(() => null);
    const result = await deleteManagedUser(caller.profile, String(body?.user_id ?? "").trim());
    if (!result.ok) {
      return jsonError(result.error, result.status);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonDbError(error instanceof Error ? { message: error.message } : null, "Error inesperado.");
  }
}
