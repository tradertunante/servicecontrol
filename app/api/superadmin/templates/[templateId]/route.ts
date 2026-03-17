import { NextRequest } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { jsonError, jsonOk, loadGlobalTemplate, requireSuperadminRoute } from "@/lib/superadmin/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { templateId: string } }
) {
  const caller = await requireSuperadminRoute(request);
  if (!caller) return jsonError("No autorizado.", 401);

  const templateId = String(params.templateId ?? "").trim();
  if (!templateId) return jsonError("templateId es obligatorio.");

  const template = await loadGlobalTemplate(templateId);
  if (!template.ok) return jsonError(template.error, template.status);

  const body = await request.json().catch(() => null);
  const updates: Record<string, unknown> = {};

  if (body && Object.prototype.hasOwnProperty.call(body, "name")) {
    const name = String(body.name ?? "").trim();
    if (!name) return jsonError("El nombre no puede estar vacio.");
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
    .from("audit_templates")
    .update(updates)
    .eq("id", template.templateId)
    .eq("scope", "global");

  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonOk({ template_id: template.templateId, updated_by: caller.profile.id });
}
