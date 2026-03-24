import { NextRequest } from "next/server";
import { jsonDbError } from "@/lib/api/response";
import { parseUUID, isErrorResponse } from "@/lib/api/validate";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { jsonError, jsonOk, loadGlobalPack, requireSuperadminRoute } from "@/lib/superadmin/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { packId: string } }
) {
  const caller = await requireSuperadminRoute(request);
  if (!caller) return jsonError("No autorizado.", 401);

  const packId = parseUUID(params.packId, "packId");
  if (isErrorResponse(packId)) return packId;

  const pack = await loadGlobalPack(packId);
  if (!pack.ok) return jsonError(pack.error, pack.status);

  const body = await request.json().catch(() => null);
  const businessType = String(body?.business_type ?? "").trim();
  const name = String(body?.name ?? "").trim();
  const description = String(body?.description ?? "").trim() || null;
  const active = body?.active;

  if (!businessType) return jsonError("business_type es obligatorio.");
  if (!name) return jsonError("name es obligatorio.");
  if (typeof active !== "boolean") return jsonError("active debe ser boolean.");

  const { error } = await supabaseAdmin()
    .from("global_audit_packs")
    .update({
      business_type: businessType,
      name,
      description,
      active,
    })
    .eq("id", pack.packId);

  if (error) return jsonDbError(error);

  return jsonOk({
    pack_id: pack.packId,
    updated_by: caller.profile.id,
  });
}
