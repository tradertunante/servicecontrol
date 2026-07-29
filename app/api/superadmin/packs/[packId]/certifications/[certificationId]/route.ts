import { NextRequest } from "next/server";

import { jsonDbError } from "@/lib/api/response";
import { parseUUID, isErrorResponse } from "@/lib/api/validate";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { jsonError, jsonOk, loadGlobalPack, requireSuperadminRoute } from "@/lib/superadmin/server";

export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ packId: string; certificationId: string }> }
) {
  const params = await props.params;
  const caller = await requireSuperadminRoute(request);
  if (!caller) return jsonError("No autorizado.", 401);

  const packId = parseUUID(params.packId, "packId");
  if (isErrorResponse(packId)) return packId;

  const certificationId = parseUUID(params.certificationId, "certificationId");
  if (isErrorResponse(certificationId)) return certificationId;

  const pack = await loadGlobalPack(packId);
  if (!pack.ok) return jsonError(pack.error, pack.status);

  const { error } = await supabaseAdmin()
    .from("global_audit_pack_certifications")
    .delete()
    .eq("pack_id", pack.packId)
    .eq("certification_standard_id", certificationId);

  if (error) return jsonDbError(error, "No se pudo quitar el certificado del pack.");

  return jsonOk({ pack_id: pack.packId, removed: certificationId, removed_by: caller.profile.id });
}
