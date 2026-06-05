import { NextRequest } from "next/server";
import { jsonDbError } from "@/lib/api/response";
import { parseUUID, isErrorResponse } from "@/lib/api/validate";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { jsonError, jsonOk, loadGlobalTemplate, requireSuperadminRoute } from "@/lib/superadmin/server";

export async function POST(
  request: NextRequest,
  { params }: { params: { templateId: string } }
) {
  const caller = await requireSuperadminRoute(request);
  if (!caller) return jsonError("No autorizado.", 401);

  const templateId = parseUUID(params.templateId, "templateId");
  if (isErrorResponse(templateId)) return templateId;

  const source = await loadGlobalTemplate(templateId);
  if (!source.ok) return jsonError(source.error, source.status);

  const admin = supabaseAdmin();

  // Load source template
  const { data: tpl, error: tplErr } = await admin
    .from("audit_templates")
    .select("name, scope, active, area_id")
    .eq("id", source.templateId)
    .single();
  if (tplErr || !tpl) return jsonDbError(tplErr, "No se pudo leer la plantilla.");

  // Create new template
  const { data: newTpl, error: newTplErr } = await admin
    .from("audit_templates")
    .insert({ name: `${tpl.name} (copia)`, scope: "global", active: tpl.active, area_id: tpl.area_id })
    .select("id")
    .single();
  if (newTplErr || !newTpl?.id) return jsonDbError(newTplErr, "No se pudo crear la copia.");

  const newTemplateId = String(newTpl.id);

  // Load source sections
  const { data: sections, error: secErr } = await admin
    .from("audit_sections")
    .select("id, name, active, created_at")
    .eq("audit_template_id", source.templateId)
    .order("created_at", { ascending: true });
  if (secErr) return jsonDbError(secErr, "No se pudieron leer las secciones.");

  for (const sec of sections ?? []) {
    const { data: newSec, error: newSecErr } = await admin
      .from("audit_sections")
      .insert({ name: sec.name, active: sec.active, audit_template_id: newTemplateId })
      .select("id")
      .single();
    if (newSecErr || !newSec?.id) return jsonDbError(newSecErr, "Error copiando sección.");

    // Load questions for this section
    const { data: questions, error: qErr } = await admin
      .from("audit_questions")
      .select("text, tag, order, active, comment_requirement, photo_requirement, signature_requirement")
      .eq("audit_section_id", sec.id)
      .order("order", { ascending: true });
    if (qErr) return jsonDbError(qErr, "Error leyendo preguntas.");

    if (questions && questions.length > 0) {
      const { error: insertQErr } = await admin.from("audit_questions").insert(
        questions.map((q) => ({
          audit_section_id: String(newSec.id),
          text: q.text,
          tag: q.tag,
          order: q.order,
          active: q.active,
          comment_requirement: q.comment_requirement,
          photo_requirement: q.photo_requirement,
          signature_requirement: q.signature_requirement,
        }))
      );
      if (insertQErr) return jsonDbError(insertQErr, "Error copiando preguntas.");
    }
  }

  return jsonOk({ template_id: newTemplateId, duplicated_by: caller.profile.id });
}