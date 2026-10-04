import { NextRequest } from "next/server";

import { authorizeRouteRequest } from "@/lib/auth/server";
import { addExistingUserToHotel, resolveManagedHotelId } from "@/lib/auth/userManagement";
import { jsonError, jsonOk } from "@/lib/api/response";
import { logAdminAction } from "@/lib/admin/auditLog";

export async function POST(request: NextRequest) {
  try {
    const caller = await authorizeRouteRequest(request, { roles: ["admin", "superadmin"] });
    if (!caller) return jsonError("No autorizado.", 401);

    const body = await request.json().catch(() => null);
    const result = await addExistingUserToHotel(caller.profile, body ?? {});
    if (!result.ok) return jsonError(result.error, result.status);

    const hotel = await resolveManagedHotelId(caller.profile);
    if (hotel.ok) {
      void logAdminAction({
        hotelId: hotel.hotelId,
        actorId: caller.profile.id,
        actorName: caller.profile.full_name ?? caller.profile.id,
        targetId: result.user.id,
        targetName: result.user.full_name ?? result.user.email ?? result.user.id,
        action: "membership_added",
        newValue: result.user.role,
      });
    }

    return jsonOk({ user: result.user });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Error inesperado.", 500);
  }
}
