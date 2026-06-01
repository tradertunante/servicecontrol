import { NextRequest, NextResponse } from "next/server";

import { authorizeRouteRequest } from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  canManageExistingUser,
  loadManagedUser,
  resolveManagedHotelId,
} from "@/lib/auth/userManagement";
import { jsonError, jsonDbError } from "@/lib/api/response";
import { parseUUID, isErrorResponse } from "@/lib/api/validate";
import { sendWelcomeEmail } from "@/lib/email/sendWelcomeEmail";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const caller = await authorizeRouteRequest(request, { roles: ["admin", "superadmin"] });
    if (!caller) return jsonError("No autorizado.", 401);

    const userId = parseUUID(params.id, "user_id");
    if (isErrorResponse(userId)) return userId;

    const hotelResult = resolveManagedHotelId(caller.profile);
    if (!hotelResult.ok) return jsonError(hotelResult.error, hotelResult.status);

    const target = await loadManagedUser(userId, hotelResult.hotelId);
    if (!target) return jsonError("Usuario no encontrado.", 404);
    if (!target.email) return jsonError("El usuario no tiene email.", 400);

    if (!canManageExistingUser(caller.profile.role, target.role)) {
      return jsonError("No puedes administrar este usuario.", 403);
    }

    const admin = supabaseAdmin();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.servicecontrol.io";

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: target.email,
      options: { redirectTo: `${appUrl}/reset-password` },
    });
    if (linkError) return jsonDbError(linkError);

    const activationUrl = linkData?.properties?.action_link ?? null;

    const { data: hotel } = await admin
      .from("hotels")
      .select("name")
      .eq("id", hotelResult.hotelId)
      .single();

    await sendWelcomeEmail({
      to: target.email,
      userName: target.full_name,
      hotelName: hotel?.name ?? "Su hotel",
      loginUrl: `${appUrl}/login`,
      activationUrl,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonDbError(
      error instanceof Error ? { message: error.message } : null,
      "Error inesperado."
    );
  }
}