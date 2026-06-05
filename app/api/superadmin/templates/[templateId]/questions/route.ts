import { NextRequest } from "next/server";
import { jsonDbError } from "@/lib/api/response";
import { parseUUID, isErrorResponse } from "@/lib/api/validate";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  jsonError,
  jsonOk,
  loadGlobalTemplate,
  parseRequirementType,
  requireSuperadminRoute,
} from "@/lib/superadmin/server";

function uniqueStrings(values: unknown[]) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
    )
  );
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { templateId: string } }
) {
  const caller = await requireSuperadminRoute(request);
  if (!caller) return jsonError("No autorizado.", 401);

  const templateId = parseUUID(params.templateId, "templateId");
  if (isErrorResponse(templateId)) return templateId;

  const template = await loadGlobalTemplate(templateId);
  if (!template.ok) return jsonError(template.error, template.status);

  const body = await request.json().catch(() => null);
  const questionIds = uniqueStrings(
    Array.isArray(body?.question_ids)
      ? body.question_ids
      : body?.question_id
      ? [body.question_id]
      : []
  );
  const rawPatch = body?.patch && typeof body.patch === "object" ? body.patch : null;

  if (questionIds.length === 0) return jsonError("question_ids es obligatorio.");
  if (!rawPatch) return jsonError("patch es obligatorio.");

  const patch: Record<string, unknown> = {};

  if (Object.prototype.hasOwnProperty.call(rawPatch, "text")) {
    const text = String((rawPatch as Record<string, unknown>).text ?? "").trim();
    if (!text) return jsonError("text no puede estar vacio.");
    patch.text = text;
  }

  if (Object.prototype.hasOwnProperty.call(rawPatch, "tag")) {
    const tagRaw = (rawPatch as Record<string, unknown>).tag;
    patch.tag = tagRaw == null ? null : String(tagRaw).trim() || null;
  }

  if (Object.prototype.hasOwnProperty.call(rawPatch, "order")) {
    const order = Number((rawPatch as Record<string, unknown>).order);
    if (!Number.isInteger(order) || order <= 0) {
      return jsonError("order debe ser un entero positivo.");
    }
    patch.order = order;
  }

  if (Object.prototype.hasOwnProperty.call(rawPatch, "active")) {
    if (typeof (rawPatch as Record<string, unknown>).active !== "boolean") {
      return jsonError("active debe ser boolean.");
    }
    patch.active = (rawPatch as Record<string, unknown>).active;
  }

  for (const key of ["comment_requirement", "photo_requirement", "signature_requirement"] as const) {
    if (!Object.prototype.hasOwnProperty.call(rawPatch, key)) continue;
    const value = parseRequirementType((rawPatch as Record<string, unknown>)[key]);
    if (!value) {
      return jsonError(`${key} debe ser uno de: never, if_fail, always.`);
    }
    patch[key] = value;
  }

  if (Object.keys(patch).length === 0) {
    return jsonError("No hay campos permitidos para actualizar.");
  }

  const admin = supabaseAdmin();
  const { data: sections, error: sectionsError } = await admin
    .from("audit_sections")
    .select("id")
    .eq("audit_template_id", template.templateId);

  if (sectionsError) return jsonDbError(sectionsError);

  const sectionIds = (sections ?? []).map((row) => String(row.id ?? "")).filter(Boolean);
  if (sectionIds.length === 0) return jsonError("La plantilla no tiene secciones.", 409);

  const { data: questions, error: questionsError } = await admin
    .from("audit_questions")
    .select("id")
    .in("id", questionIds)
    .in("audit_section_id", sectionIds);

  if (questionsError) return jsonDbError(questionsError);

  const foundIds = new Set((questions ?? []).map((row) => String(row.id ?? "")));
  if (foundIds.size !== questionIds.length) {
    return jsonError("Alguna pregunta no pertenece a la plantilla global objetivo.", 403);
  }

  const { error: updateError } = await admin
    .from("audit_questions")
    .update(patch)
    .in("id", questionIds);

  if (updateError) return jsonDbError(updateError);

  return jsonOk({
    question_ids: questionIds,
    updated_by: caller.profile.id,
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { templateId: string } }
) {
  const caller = await requireSuperadminRoute(request);
  if (!caller) return jsonError("No autorizado.", 401);

  const templateId = parseUUID(params.templateId, "templateId");
  if (isErrorResponse(templateId)) return templateId;

  const template = await loadGlobalTemplate(templateId);
  if (!template.ok) return jsonError(template.error, template.status);

  const body = await request.json().catch(() => null);
  const questionIds = uniqueStrings(
    Array.isArray(body?.question_ids) ? body.question_ids : body?.question_id ? [body.question_id] : []
  );
  if (questionIds.length === 0) return jsonError("question_ids es obligatorio.");

  const admin = supabaseAdmin();

  // Verify questions belong to this template
  const { data: sections } = await admin.from("audit_sections").select("id").eq("audit_template_id", template.templateId);
  const sectionIds = (sections ?? []).map((s) => String(s.id));
  if (!sectionIds.length) return jsonError("La plantilla no tiene secciones.", 409);

  const { data: found } = await admin.from("audit_questions").select("id").in("id", questionIds).in("audit_section_id", sectionIds);
  if ((found ?? []).length !== questionIds.length) return jsonError("Alguna pregunta no pertenece a esta plantilla.", 403);

  const { error } = await admin.from("audit_questions").delete().in("id", questionIds);
  if (error) return jsonDbError(error);

  return jsonOk({ deleted: questionIds, deleted_by: caller.profile.id });
}
