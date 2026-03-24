import { NextRequest } from "next/server";
import { jsonDbError } from "@/lib/api/response";
import { parseUUID, isErrorResponse } from "@/lib/api/validate";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { jsonError, jsonOk, loadGlobalPack, requireSuperadminRoute } from "@/lib/superadmin/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { packId: string; templateId: string } }
) {
  const caller = await requireSuperadminRoute(request);
  if (!caller) return jsonError("No autorizado.", 401);

  const packId = parseUUID(params.packId, "packId");
  if (isErrorResponse(packId)) return packId;
  const templateId = parseUUID(params.templateId, "templateId");
  if (isErrorResponse(templateId)) return templateId;

  const pack = await loadGlobalPack(packId);
  if (!pack.ok) return jsonError(pack.error, pack.status);

  const body = await request.json().catch(() => null);
  const position = Number(body?.position);

  if (!Number.isInteger(position) || position < 0) {
    return jsonError("position debe ser un entero mayor o igual a 0.");
  }

  const { error } = await supabaseAdmin()
    .from("global_audit_pack_templates")
    .update({ position })
    .eq("pack_id", pack.packId)
    .eq("audit_template_id", templateId);

  if (error) return jsonDbError(error);

  return jsonOk({
    pack_id: pack.packId,
    template_id: templateId,
    updated_by: caller.profile.id,
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { packId: string; templateId: string } }
) {
  const caller = await requireSuperadminRoute(request);
  if (!caller) return jsonError("No autorizado.", 401);

  const packId = parseUUID(params.packId, "packId");
  if (isErrorResponse(packId)) return packId;
  const templateId = parseUUID(params.templateId, "templateId");
  if (isErrorResponse(templateId)) return templateId;

  const pack = await loadGlobalPack(packId);
  if (!pack.ok) return jsonError(pack.error, pack.status);

  const { error } = await supabaseAdmin()
    .from("global_audit_pack_templates")
    .delete()
    .eq("pack_id", pack.packId)
    .eq("audit_template_id", templateId);

  if (error) return jsonDbError(error);

  return jsonOk({
    pack_id: pack.packId,
    template_id: templateId,
    updated_by: caller.profile.id,
  });
}
