import { NextRequest } from "next/server";

import { jsonDbError } from "@/lib/api/response";
import { parseUUID, isErrorResponse } from "@/lib/api/validate";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { jsonError, jsonOk, loadCertification, loadGlobalPack, requireSuperadminRoute } from "@/lib/superadmin/server";

export async function POST(request: NextRequest, props: { params: Promise<{ packId: string }> }) {
  const params = await props.params;
  const caller = await requireSuperadminRoute(request);
  if (!caller) return jsonError("No autorizado.", 401);

  const packId = parseUUID(params.packId, "packId");
  if (isErrorResponse(packId)) return packId;

  const pack = await loadGlobalPack(packId);
  if (!pack.ok) return jsonError(pack.error, pack.status);

  const body = await request.json().catch(() => null);
  const certificationStandardId = parseUUID(body?.certification_standard_id, "certification_standard_id");
  if (isErrorResponse(certificationStandardId)) return certificationStandardId;

  const certification = await loadCertification(certificationStandardId);
  if (!certification.ok) return jsonError(certification.error, certification.status);

  const { error } = await supabaseAdmin()
    .from("global_audit_pack_certifications")
    .insert({ pack_id: pack.packId, certification_standard_id: certification.certificationId });

  if (error) {
    if (error.code === "23505") {
      return jsonError("Este certificado ya está en el pack.");
    }
    return jsonDbError(error, "No se pudo añadir el certificado al pack.");
  }

  return jsonOk({ pack_id: pack.packId, certification_standard_id: certification.certificationId });
}
