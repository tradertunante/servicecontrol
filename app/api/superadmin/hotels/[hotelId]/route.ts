import { NextRequest } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { jsonDbError } from "@/lib/api/response";
import { parseUUID, isErrorResponse } from "@/lib/api/validate";
import { jsonError, jsonOk, requireSuperadminRoute } from "@/lib/superadmin/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { hotelId: string } }
) {
  const caller = await requireSuperadminRoute(request);
  if (!caller) return jsonError("No autorizado.", 401);

  const hotelId = parseUUID(params.hotelId, "hotelId");
  if (isErrorResponse(hotelId)) return hotelId;

  // Usamos select("*") y casteamos para incluir enabled_packs
  // (columna añadida por migración, no en los types generados aún)
  const { data, error } = await supabaseAdmin()
    .from("hotels")
    .select("*")
    .eq("id", hotelId)
    .maybeSingle() as unknown as { data: Record<string, unknown> | null; error: unknown };

  if (error) return jsonDbError(error as Parameters<typeof jsonDbError>[0], "No se pudo obtener el hotel.");
  if (!data) return jsonError("Hotel no encontrado.", 404);

  const enabledPacks: string[] = Array.isArray(data.enabled_packs)
    ? (data.enabled_packs as string[])
    : ["base"];

  return jsonOk({
    hotel: {
      id: String(data.id),
      name: String(data.name ?? ""),
      active: (data.active as boolean | null) ?? null,
      created_at: data.created_at ? String(data.created_at) : null,
      enabled_packs: enabledPacks,
    },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { hotelId: string } }
) {
  const caller = await requireSuperadminRoute(request);
  if (!caller) return jsonError("No autorizado.", 401);

  const hotelId = parseUUID(params.hotelId, "hotelId");
  if (isErrorResponse(hotelId)) return hotelId;

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

  if (body && Object.prototype.hasOwnProperty.call(body, "enabled_packs")) {
    const packs = body.enabled_packs;
    if (!Array.isArray(packs)) return jsonError("enabled_packs debe ser un array.");
    const valid = ["base", "pack1", "pack_it", "pack_engineering", "pack2", "pack3"];
    if (!packs.every((p: unknown) => typeof p === "string" && valid.includes(p))) {
      return jsonError("enabled_packs contiene valores inválidos.");
    }
    // base siempre incluido
    updates.enabled_packs = Array.from(new Set(["base", ...packs]));
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
