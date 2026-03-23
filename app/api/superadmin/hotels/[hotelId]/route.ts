import { NextRequest } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { jsonDbError } from "@/lib/api/response";
import { jsonError, jsonOk, requireSuperadminRoute } from "@/lib/superadmin/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { hotelId: string } }
) {
  const caller = await requireSuperadminRoute(request);
  if (!caller) return jsonError("No autorizado.", 401);

  const hotelId = String(params.hotelId ?? "").trim();
  if (!hotelId) return jsonError("hotelId es obligatorio.");

  const body = await request.json().catch(() => null);
  const updates: Record<string, unknown> = {};

  if (body && Object.prototype.hasOwnProperty.call(body, "active")) {
    if (typeof body.active !== "boolean") return jsonError("active debe ser boolean.");
    updates.active = body.active;
  }

  if (body && Object.prototype.hasOwnProperty.call(body, "name")) {
    const name = String(body.name ?? "").trim();
    if (!name) return jsonError("name no puede estar vacio.");
    updates.name = name;
  }

  if (Object.keys(updates).length === 0) {
    return jsonError("No hay cambios permitidos para aplicar.");
  }

  const { data, error } = await supabaseAdmin()
    .from("hotels")
    .update(updates)
    .eq("id", hotelId)
    .select("id, name, active, created_at")
    .single();

  if (error || !data?.id) {
    if (error) return jsonDbError(error, "No se pudo actualizar el hotel.");
    return jsonError("No se pudo actualizar el hotel.", 404);
  }

  return jsonOk({
    hotel: {
      id: String(data.id),
      name: String(data.name ?? ""),
      active: data.active ?? null,
      created_at: data.created_at ? String(data.created_at) : null,
    },
    updated_by: caller.profile.id,
  });
}
