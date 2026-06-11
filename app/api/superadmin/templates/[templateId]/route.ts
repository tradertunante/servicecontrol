import { NextRequest } from "next/server";
import { jsonDbError } from "@/lib/api/response";
import { parseUUID, isErrorResponse } from "@/lib/api/validate";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { jsonError, jsonOk, loadGlobalTemplate, requireSuperadminRoute } from "@/lib/superadmin/server";

export async function PATCH(request: NextRequest, props: { params: Promise<{ templateId: string }> }) {
  const params = await props.params;
  const caller = await requireSuperadminRoute(request);
  if (!caller) return jsonError("No autorizado.", 401);

  const templateId = parseUUID(params.templateId, "templateId");
  if (isErrorResponse(templateId)) return templateId;

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

  if (body && Object.prototype.hasOwnProperty.call(body, "category")) {
    updates.category = body.category === null || body.category === "" ? null : String(body.category).trim();
  }

  if (body && Object.prototype.hasOwnProperty.call(body, "language")) {
    const lang = String(body.language ?? "es").trim();
    if (!lang) return jsonError("El idioma no puede estar vacío.");
    updates.language = lang;
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
    return jsonDbError(error);
  }

  return jsonOk({ template_id: template.templateId, updated_by: caller.profile.id });
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ templateId: string }> }) {
  const params = await props.params;
  const caller = await requireSuperadminRoute(request);
  if (!caller) return jsonError("No autorizado.", 401);

  const templateId = parseUUID(params.templateId, "templateId");
  if (isErrorResponse(templateId)) return templateId;

  const template = await loadGlobalTemplate(templateId);
  if (!template.ok) return jsonError(template.error, template.status);

  const admin = supabaseAdmin();

  // Remove from packs
  const { error: packErr } = await admin
    .from("global_audit_pack_templates")
    .delete()
    .eq("audit_template_id", template.templateId);
  if (packErr) return jsonDbError(packErr, "Error quitando del pack.");

  // Load sections
  const { data: sections, error: secReadErr } = await admin
    .from("audit_sections")
    .select("id")
    .eq("audit_template_id", template.templateId);
  if (secReadErr) return jsonDbError(secReadErr, "Error leyendo secciones.");

  const secIds = (sections ?? []).map((s) => s.id);

  if (secIds.length > 0) {
    const { error: qErr } = await admin.from("audit_questions").delete().in("audit_section_id", secIds);
    if (qErr) return jsonDbError(qErr, "Error eliminando preguntas.");

    const { error: secErr } = await admin.from("audit_sections").delete().in("id", secIds);
    if (secErr) return jsonDbError(secErr, "Error eliminando secciones.");
  }

  const { error: tplErr } = await admin
    .from("audit_templates")
    .delete()
    .eq("id", template.templateId)
    .eq("scope", "global");
  if (tplErr) return jsonDbError(tplErr, "Error eliminando plantilla.");

  return jsonOk({ deleted: template.templateId, deleted_by: caller.profile.id });
}
