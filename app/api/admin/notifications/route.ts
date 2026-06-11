import { NextRequest, NextResponse } from "next/server";

import { authorizeRouteRequest, resolveRouteHotelScope } from "@/lib/auth/server";
import { jsonError, jsonDbError } from "@/lib/api/response";
import {
  getHotelNotificationSettings,
  upsertHotelNotificationSettings,
} from "@/lib/notifications/notificationSettings";

async function getAdminScope(request: NextRequest) {
  const caller = await authorizeRouteRequest(request, {
    roles: ["admin", "superadmin", "general_manager"],
  });
  if (!caller) return { ok: false as const, error: "No autorizado.", status: 401 };

  const hotelResult = await resolveRouteHotelScope(caller.profile, null);
  if (!hotelResult.ok) return hotelResult;

  return { ok: true as const, hotelId: hotelResult.hotelId };
}

export async function GET(request: NextRequest) {
  try {
    const scope = await getAdminScope(request);
    if (!scope.ok) return jsonError(scope.error, scope.status);

    const settings = await getHotelNotificationSettings(scope.hotelId);
    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    return jsonDbError(error instanceof Error ? { message: error.message } : null, "Error inesperado.");
  }
}

export async function PUT(request: NextRequest) {
  try {
    const scope = await getAdminScope(request);
    if (!scope.ok) return jsonError(scope.error, scope.status);

    const body = await request.json().catch(() => null);

    const payload: Record<string, boolean> = {};

    if (typeof body?.new_user_email_enabled === "boolean") {
      payload.new_user_email_enabled = body.new_user_email_enabled;
    }
    if (typeof body?.quality_audit_submitted_email_enabled === "boolean") {
      payload.quality_audit_submitted_email_enabled = body.quality_audit_submitted_email_enabled;
    }

    if (Object.keys(payload).length === 0) {
      return jsonError("No se enviaron campos válidos.", 400);
    }

    await upsertHotelNotificationSettings(scope.hotelId, payload);

    const settings = await getHotelNotificationSettings(scope.hotelId);
    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    return jsonDbError(error instanceof Error ? { message: error.message } : null, "Error inesperado.");
  }
}
