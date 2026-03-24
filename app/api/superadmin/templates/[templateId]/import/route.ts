import { NextRequest } from "next/server";
import { jsonDbError } from "@/lib/api/response";
import { parseUUID, isErrorResponse } from "@/lib/api/validate";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  jsonError,
  jsonOk,
  loadGlobalTemplate,
  normalizeTemplateQuestionOrder,
  requireSuperadminRoute,
} from "@/lib/superadmin/server";

type ImportRow = {
  standard: string;
  tag: string | null;
  classification: string;
};

function cleanCell(value: unknown) {
  return String(value ?? "")
    .replace(/\u00A0/g, " ")
    .trim();
}

function normKey(value: string) {
  return cleanCell(value)
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export async function POST(
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
  const rawRows = Array.isArray(body?.rows) ? body.rows : [];

  if (rawRows.length === 0) {
    return jsonError("rows debe incluir al menos una fila valida.");
  }

  const rows: ImportRow[] = [];
  for (const rawRow of rawRows) {
    const standard = cleanCell((rawRow as Record<string, unknown>)?.standard);
    const classification = cleanCell((rawRow as Record<string, unknown>)?.classification);
    const tag = cleanCell((rawRow as Record<string, unknown>)?.tag) || null;

    if (!standard || !classification) continue;
    rows.push({ standard, tag, classification });
  }

  if (rows.length === 0) {
    return jsonError("No hay filas importables despues de validar el payload.");
  }

  const admin = supabaseAdmin();
  const { data: existingSections, error: sectionsError } = await admin
    .from("audit_sections")
    .select("id, name")
    .eq("audit_template_id", template.templateId);

  if (sectionsError) return jsonDbError(sectionsError);

  const sectionMap = new Map<string, { id: string; name: string }>();
  for (const section of existingSections ?? []) {
    const name = cleanCell(section.name);
    sectionMap.set(normKey(name), { id: String(section.id), name });
  }

  const orderedSections: string[] = [];
  const seenSections = new Set<string>();
  for (const row of rows) {
    const key = normKey(row.classification);
    if (seenSections.has(key)) continue;
    seenSections.add(key);
    orderedSections.push(row.classification);
  }

  for (const sectionName of orderedSections) {
    const key = normKey(sectionName);
    if (sectionMap.has(key)) continue;

    const { data: insertedSection, error: insertSectionError } = await admin
      .from("audit_sections")
      .insert({
        audit_template_id: template.templateId,
        name: sectionName,
        active: true,
      })
      .select("id, name")
      .single();

    if (insertSectionError || !insertedSection?.id) {
      return jsonDbError(insertSectionError, "No se pudo crear una seccion.");
    }

    sectionMap.set(normKey(insertedSection.name), {
      id: String(insertedSection.id),
      name: String(insertedSection.name),
    });
  }

  const orderCounters = new Map<string, number>();
  const inserts = rows.map((row) => {
    const section = sectionMap.get(normKey(row.classification));
    if (!section) {
      throw new Error(`No se pudo resolver la seccion para "${row.classification}".`);
    }

    const currentOrder = orderCounters.get(section.id) ?? 0;
    const nextOrder = currentOrder + 1;
    orderCounters.set(section.id, nextOrder);

    return {
      audit_section_id: section.id,
      text: row.standard,
      tag: row.tag,
      order: nextOrder,
      active: true,
      comment_requirement: "never",
      photo_requirement: "never",
      signature_requirement: "never",
    };
  });

  const { error: insertQuestionsError } = await admin
    .from("audit_questions")
    .insert(inserts);

  if (insertQuestionsError) {
    return jsonDbError(insertQuestionsError);
  }

  try {
    await normalizeTemplateQuestionOrder(template.templateId);
  } catch (error) {
    return jsonDbError(error instanceof Error ? { message: error.message } : null, "No se pudo normalizar el orden.");
  }

  return jsonOk({
    template_id: template.templateId,
    sections_count: sectionMap.size,
    imported_questions: inserts.length,
    imported_by: caller.profile.id,
  });
}
