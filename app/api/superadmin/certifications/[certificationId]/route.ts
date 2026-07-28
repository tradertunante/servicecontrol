import { NextRequest } from "next/server";

import { jsonDbError } from "@/lib/api/response";
import { parseUUID, isErrorResponse } from "@/lib/api/validate";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { jsonError, jsonOk, loadCertification, requireSuperadminRoute } from "@/lib/superadmin/server";

export async function PATCH(request: NextRequest, props: { params: Promise<{ certificationId: string }> }) {
  const params = await props.params;
  const caller = await requireSuperadminRoute(request);
  if (!caller) return jsonError("No autorizado.", 401);

  const certificationId = parseUUID(params.certificationId, "certificationId");
  if (isErrorResponse(certificationId)) return certificationId;

  const certification = await loadCertification(certificationId);
  if (!certification.ok) return jsonError(certification.error, certification.status);

  const body = await request.json().catch(() => null);
  const updates: Record<string, unknown> = {};

  if (body && Object.prototype.hasOwnProperty.call(body, "name")) {
    const name = String(body.name ?? "").trim();
    if (!name) return jsonError("El nombre no puede estar vacío.");
    updates.name = name;
  }

  if (body && Object.prototype.hasOwnProperty.call(body, "active")) {
    if (typeof body.active !== "boolean") return jsonError("active debe ser boolean.");
    updates.active = body.active;
  }

  if (Object.keys(updates).length === 0) {
    return jsonError("No hay cambios permitidos para aplicar.");
  }

  const { error } = await supabaseAdmin()
    .from("certification_standards")
    .update(updates)
    .eq("id", certification.certificationId);

  if (error) {
    if (error.code === "23505") {
      return jsonError("Ya existe un certificado con ese nombre.");
    }
    return jsonDbError(error);
  }

  return jsonOk({ certification_id: certification.certificationId, updated_by: caller.profile.id });
}