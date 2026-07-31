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
  standardEn: string | null;
  tag: string | null;
  classification: string;
  certificationIds: string[];
  order: number | null;
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

export async function POST(request: NextRequest, props: { params: Promise<{ templateId: string }> }) {
  const params = await props.params;
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
    const standardEn = cleanCell((rawRow as Record<string, unknown>)?.standardEn) || null;
    const classification = cleanCell((rawRow as Record<string, unknown>)?.classification);
    const tag = cleanCell((rawRow as Record<string, unknown>)?.tag) || null;
    const certificationIdsRaw = (rawRow as Record<string, unknown>)?.certificationIds;
    const certificationIds = Array.isArray(certificationIdsRaw)
      ? Array.from(new Set(certificationIdsRaw.map((id) => cleanCell(id)).filter(Boolean)))
      : [];
    const orderRaw = (rawRow as Record<string, unknown>)?.order;
    const orderNum = typeof orderRaw === "number" ? orderRaw : Number(cleanCell(orderRaw));
    const order = Number.isFinite(orderNum) && orderRaw !== null && orderRaw !== undefined && cleanCell(orderRaw) !== "" ? orderNum : null;

    if (!standard || !classification) continue;
    rows.push({ standard, standardEn, tag, classification, certificationIds, order });
  }

  if (rows.length === 0) {
    return jsonError("No hay filas importables despues de validar el payload.");
  }

  const admin = supabaseAdmin();

  const allCertificationIds = Array.from(new Set(rows.flatMap((row) => row.certificationIds)));
  let validCertificationIds = new Set<string>();
  if (allCertificationIds.length) {
    const { data: certRows, error: certError } = await admin
      .from("certification_standards")
      .select("id")
      .in("id", allCertificationIds)
      .eq("active", true);

    if (certError) return jsonDbError(certError);
    validCertificationIds = new Set((certRows ?? []).map((c) => String(c.id)));
  }
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

    let order = row.order;
    if (order === null) {
      const currentOrder = orderCounters.get(section.id) ?? 0;
      order = currentOrder + 1;
    }
    orderCounters.set(section.id, Math.max(orderCounters.get(section.id) ?? 0, order));

    return {
      audit_section_id: section.id,
      text: row.standard,
      text_en: row.standardEn,
      tag: row.tag,
      order,
      active: true,
      comment_requirement: "optional",
      photo_requirement: "optional",
      signature_requirement: "never",
    };
  });

  const { data: insertedQuestions, error: insertQuestionsError } = await admin
    .from("audit_questions")
    .insert(inserts)
    .select("id");

  if (insertQuestionsError) {
    return jsonDbError(insertQuestionsError);
  }

  const certificationLinks = (insertedQuestions ?? []).flatMap((question, index) => {
    const row = rows[index];
    const certificationIds = (row?.certificationIds ?? []).filter((id) => validCertificationIds.has(id));
    return certificationIds.map((certificationId) => ({
      question_id: question.id,
      certification_standard_id: certificationId,
    }));
  });

  if (certificationLinks.length) {
    const { error: insertCertLinksError } = await admin
      .from("audit_question_certifications")
      .insert(certificationLinks);

    if (insertCertLinksError) return jsonDbError(insertCertLinksError);
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
    imported_certification_links: certificationLinks.length,
    imported_by: caller.profile.id,
  });
}
