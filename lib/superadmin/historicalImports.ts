import "server-only";

import * as XLSX from "xlsx";

import { requireRole } from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createHistoricalRun } from "@/lib/superadmin/createHistoricalRun";
import {
  HISTORICAL_IMPORT_TEMPLATE_FILE_NAME,
  buildHistoricalImportWorkbook,
  buildHistoricalQuestionReferences,
  parseHistoricalImportRows,
} from "@/lib/superadmin/historicalImportExcel";
import {
  buildHistoricalImportHeaders,
  buildHistoricalImportQuestionCode,
  type HistoricalImportHotelOption,
  type HistoricalImportResult,
  type HistoricalImportSelectedTemplate,
  type HistoricalImportTemplateOption,
} from "@/lib/superadmin/historicalImportShared";

export type HistoricalImportQuestion = {
  id: string;
  section_id: string;
  section_name: string;
  text: string;
  tag: string | null;
  order: number;
};

export type HistoricalImportTargetTemplate = {
  id: string;
  name: string;
  area_id: string;
  area_name: string;
  active: boolean;
  compatible: boolean;
  incompatibility_reason: string | null;
  question_count: number;
};

export type HistoricalImportHotelTemplateOption = {
  id: string;
  name: string;
  area_id: string;
  area_name: string;
  active: boolean;
};

type RawQuestionRow = {
  id: string;
  text: string | null;
  tag: string | null;
  order: number | null;
  created_at: string | null;
  audit_sections:
    | {
        id: string;
        name: string | null;
        order: number | null;
        created_at: string | null;
      }
    | Array<{
        id: string;
        name: string | null;
        order: number | null;
        created_at: string | null;
      }>
    | null;
};

type RawTargetTemplateRow = {
  id: string;
  name: string | null;
  area_id: string | null;
  active: boolean | null;
  areas:
    | {
        id: string;
        name: string | null;
        active: boolean | null;
      }
    | Array<{
        id: string;
        name: string | null;
        active: boolean | null;
      }>
    | null;
};

function normalizeRelation<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function cleanText(value: unknown) {
  return String(value ?? "")
    .replace(/\u00A0/g, " ")
    .trim();
}

function normalizedKey(value: unknown) {
  return cleanText(value).replace(/\s+/g, " ").toLowerCase();
}

function safeOrder(value: number | null | undefined, fallback: number) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

export async function loadOrderedActiveTemplateQuestions(templateId: string) {
  const admin = supabaseAdmin();
  const { data: sections, error: sectionsError } = await admin
    .from("audit_sections")
    .select("id, name, order, created_at")
    .eq("audit_template_id", templateId)
    .eq("active", true)
    .order("order", { ascending: true })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (sectionsError) {
    throw new Error(sectionsError.message);
  }

  const sectionRows = (sections ?? []) as Array<{
    id: string;
    name: string | null;
    order: number | null;
    created_at: string | null;
  }>;

  if (sectionRows.length === 0) return [];

  const sectionIndex = new Map<string, number>();
  const sectionNameById = new Map<string, string>();
  sectionRows.forEach((section, index) => {
    sectionIndex.set(String(section.id), index);
    sectionNameById.set(String(section.id), cleanText(section.name));
  });

  const sectionIds = sectionRows.map((section) => String(section.id));
  const { data: questions, error: questionsError } = await admin
    .from("audit_questions")
    .select("id, text, tag, order, created_at, audit_section_id")
    .in("audit_section_id", sectionIds)
    .eq("active", true)
    .order("order", { ascending: true })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (questionsError) {
    throw new Error(questionsError.message);
  }

  return (questions ?? [])
    .map((row, index) => ({
      ...(row as RawQuestionRow & { audit_section_id: string }),
      _index: index,
    }))
    .sort((left, right) => {
      const leftSection = sectionIndex.get(String(left.audit_section_id)) ?? Number.MAX_SAFE_INTEGER;
      const rightSection = sectionIndex.get(String(right.audit_section_id)) ?? Number.MAX_SAFE_INTEGER;
      if (leftSection !== rightSection) return leftSection - rightSection;

      const leftOrder = safeOrder(left.order, left._index + 1);
      const rightOrder = safeOrder(right.order, right._index + 1);
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;

      return String(left.id).localeCompare(String(right.id));
    })
    .map((question, index) => ({
      id: String(question.id),
      section_id: String(question.audit_section_id ?? ""),
      section_name: sectionNameById.get(String(question.audit_section_id ?? "")) ?? "",
      text: cleanText(question.text),
      tag: cleanText(question.tag) || null,
      order: safeOrder(question.order, index + 1),
    })) satisfies HistoricalImportQuestion[];
}

function compareQuestionLists(
  sourceQuestions: HistoricalImportQuestion[],
  targetQuestions: HistoricalImportQuestion[],
) {
  if (sourceQuestions.length !== targetQuestions.length) {
    return `La plantilla del hotel tiene ${targetQuestions.length} preguntas activas y la global ${sourceQuestions.length}.`;
  }

  for (let index = 0; index < sourceQuestions.length; index += 1) {
    const source = sourceQuestions[index];
    const target = targetQuestions[index];
    const sameText = normalizedKey(source.text) === normalizedKey(target.text);
    const sameTag = normalizedKey(source.tag) === normalizedKey(target.tag);

    if (!sameText || !sameTag) {
      return `La pregunta ${buildHistoricalImportQuestionCode(index)} no coincide entre plantilla global y plantilla del hotel.`;
    }
  }

  return null;
}

export async function loadHistoricalImportTargets(
  sourceTemplateId: string,
  hotelId: string,
  sourceQuestions: HistoricalImportQuestion[],
) {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("audit_templates")
    .select(`
      id,
      name,
      area_id,
      active,
      areas (
        id,
        name,
        active
      )
    `)
    .eq("hotel_id", hotelId)
    .eq("source_template_id", sourceTemplateId)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const templates = (data ?? []) as RawTargetTemplateRow[];
  if (templates.length === 0) return [];

  const questionsByTemplate = new Map<string, HistoricalImportQuestion[]>();
  await Promise.all(
    templates.map(async (template) => {
      questionsByTemplate.set(
        String(template.id),
        await loadOrderedActiveTemplateQuestions(String(template.id)),
      );
    }),
  );

  return templates.map((template) => {
    const area = normalizeRelation(template.areas);
    const targetQuestions = questionsByTemplate.get(String(template.id)) ?? [];
    const compatibilityError =
      !template.area_id ? "La plantilla del hotel no tiene área asignada."
      : area?.active === false ? "El área asociada a la plantilla del hotel está inactiva."
      : template.active === false ? "La plantilla del hotel está inactiva."
      : compareQuestionLists(sourceQuestions, targetQuestions);

    return {
      id: String(template.id),
      name: cleanText(template.name) || "Plantilla",
      area_id: cleanText(template.area_id),
      area_name: cleanText(area?.name) || "Área",
      active: template.active !== false,
      compatible: compatibilityError == null,
      incompatibility_reason: compatibilityError,
      question_count: targetQuestions.length,
    } satisfies HistoricalImportTargetTemplate;
  });
}

export async function loadHistoricalImportHotelTemplates(hotelId: string) {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("audit_templates")
    .select(`
      id,
      name,
      area_id,
      active,
      areas (
        id,
        name,
        active
      )
    `)
    .eq("hotel_id", hotelId)
    .eq("active", true)
    .not("area_id", "is", null)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as RawTargetTemplateRow[])
    .map((template) => {
      const area = normalizeRelation(template.areas);
      if (!template.area_id || area?.active === false) return null;

      return {
        id: String(template.id),
        name: cleanText(template.name) || "Template",
        area_id: cleanText(template.area_id),
        area_name: cleanText(area?.name) || "Área",
        active: template.active !== false,
      } satisfies HistoricalImportHotelTemplateOption;
    })
    .filter((template): template is HistoricalImportHotelTemplateOption => Boolean(template));
}

type ValidatedImportRow = {
  row_number: number;
  executed_at: string;
  auditor_email: string;
  team_member_employee_number: string | null;
  notes: string | null;
  answers_by_code: Record<string, "PASS" | "FAIL" | "NA">;
  answers: Array<{
    question_id: string;
    answer: "PASS" | "FAIL" | "NA";
    result: "PASS" | "FAIL" | "NA";
  }>;
  score: number;
};

const ANSWER_VALUES = new Set(["PASS", "FAIL", "NA"]);

function cleanCell(value: unknown) {
  return String(value ?? "")
    .replace(/\u00A0/g, " ")
    .trim();
}

function toIsoTimestamp(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

async function requireSuperadminHistoricalImport() {
  return requireRole(["superadmin"], {
    nextPath: "/superadmin/historical-import",
    redirectTo: "/dashboard",
  });
}

async function loadHotelOrError(hotelId: string) {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("hotels")
    .select("id, name, active")
    .eq("id", hotelId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("El hotel seleccionado no existe.");
  if (data.active === false) throw new Error("El hotel seleccionado está inactivo.");

  return {
    id: String(data.id),
    name: cleanText(data.name) || "Hotel",
  };
}

async function loadTemplateOrError(templateId: string, hotelId: string): Promise<HistoricalImportSelectedTemplate> {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("audit_templates")
    .select(`
      id,
      name,
      hotel_id,
      area_id,
      active,
      areas (
        id,
        name,
        active
      )
    `)
    .eq("id", templateId)
    .eq("hotel_id", hotelId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("El template seleccionado no pertenece al hotel.");
  if (data.active === false) throw new Error("El template seleccionado está inactivo.");

  const area = Array.isArray(data.areas) ? data.areas[0] ?? null : data.areas ?? null;
  if (!data.area_id || !area?.id || area.active === false) {
    throw new Error("El template seleccionado debe tener un área activa.");
  }

  const questions = await loadOrderedActiveTemplateQuestions(String(data.id));

  return {
    id: String(data.id),
    name: cleanText(data.name) || "Template",
    hotel_id: String(data.hotel_id ?? hotelId),
    area_id: String(data.area_id),
    area_name: cleanText(area.name) || "Área",
    question_count: questions.length,
  };
}

export async function getHistoricalImportHotels(): Promise<HistoricalImportHotelOption[]> {
  await requireSuperadminHistoricalImport();

  const { data, error } = await supabaseAdmin()
    .from("hotels")
    .select("id, name, active")
    .eq("active", true)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((hotel) => ({
    id: String(hotel.id),
    name: cleanText(hotel.name) || "Hotel",
    active: hotel.active !== false,
  }));
}

export async function getHistoricalImportTemplatesByHotel(
  hotelId: string,
): Promise<HistoricalImportTemplateOption[]> {
  await requireSuperadminHistoricalImport();
  await loadHotelOrError(hotelId);
  return loadHistoricalImportHotelTemplates(hotelId);
}

export async function getHistoricalImportTemplateContext(hotelId: string, templateId: string) {
  await requireSuperadminHistoricalImport();
  await loadHotelOrError(hotelId);
  const template = await loadTemplateOrError(templateId, hotelId);
  const questions = await loadOrderedActiveTemplateQuestions(template.id);

  return {
    selected_template: template,
    question_references: buildHistoricalQuestionReferences(questions),
    expected_headers: buildHistoricalImportHeaders(questions.length),
  };
}

export async function generateTemplate(hotelId: string, templateId: string) {
  await requireSuperadminHistoricalImport();
  await loadHotelOrError(hotelId);
  const template = await loadTemplateOrError(templateId, hotelId);
  const questions = await loadOrderedActiveTemplateQuestions(template.id);
  if (questions.length === 0) {
    throw new Error("El template seleccionado no tiene preguntas activas.");
  }

  const workbook = buildHistoricalImportWorkbook(questions);
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  return {
    file_name: HISTORICAL_IMPORT_TEMPLATE_FILE_NAME,
    content_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    bytes_base64: buffer.toString("base64"),
  };
}

export async function createHistoricalImport(formData: FormData): Promise<HistoricalImportResult> {
  const auth = await requireSuperadminHistoricalImport();
  const actorUserId = String(auth.profile.id ?? "").trim();
  if (!actorUserId) throw new Error("executed_by missing");

  const hotelId = cleanCell(formData.get("hotel_id") ?? formData.get("hotelId"));
  const templateId = cleanCell(formData.get("template_id") ?? formData.get("templateId"));
  const file = formData.get("file");

  if (!hotelId) throw new Error("hotel_id es obligatorio.");
  if (!templateId) throw new Error("template_id es obligatorio.");
  if (!(file instanceof File)) throw new Error("Debes adjuntar un archivo Excel.");

  const fileName = cleanCell(file.name).toLowerCase();
  if (!fileName.endsWith(".xlsx") && !fileName.endsWith(".xls")) {
    throw new Error("El archivo debe ser .xlsx o .xls.");
  }

  const hotel = await loadHotelOrError(hotelId);
  const template = await loadTemplateOrError(templateId, hotel.id);
  const questions = await loadOrderedActiveTemplateQuestions(template.id);
  if (questions.length === 0) {
    throw new Error("El template seleccionado no tiene preguntas activas.");
  }

  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) throw new Error("El archivo no contiene hojas.");

  const sheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    blankrows: false,
    defval: "",
    raw: false,
  });

  const parsedWorkbook = parseHistoricalImportRows(rawRows, questions.length);
  if (!parsedWorkbook.ok) throw new Error(parsedWorkbook.error);

  const dataRows = (rawRows.slice(1) as unknown[][]).filter((row) =>
    (Array.isArray(row) ? row : []).some((cell) => cleanCell(cell).length > 0),
  );
  if (dataRows.length === 0) {
    throw new Error("El archivo no contiene filas de auditorías para importar.");
  }

  const validatedRows: ValidatedImportRow[] = [];
  const rowResults: HistoricalImportResult["row_results"] = [];

  for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex += 1) {
    const row = dataRows[rowIndex];
    const rowNumber = rowIndex + 2;
    const executedAtRaw = cleanCell(row[0]);
    const auditorEmail = cleanCell(row[1]);
    const employeeNumber = cleanCell(row[2]) || null;
    const notes = cleanCell(row[3]) || null;

    if (!executedAtRaw) {
      rowResults.push({ row_number: rowNumber, success: false, status: "error", message: "executed_at es obligatorio.", run_id: null });
      continue;
    }

    const executedAt = toIsoTimestamp(executedAtRaw);
    if (!executedAt) {
      rowResults.push({ row_number: rowNumber, success: false, status: "error", message: "executed_at no tiene un formato de fecha válido.", run_id: null });
      continue;
    }

    if (new Date(executedAt).getTime() > Date.now()) {
      rowResults.push({ row_number: rowNumber, success: false, status: "error", message: "executed_at no puede ser futura.", run_id: null });
      continue;
    }

    if (!auditorEmail) {
      rowResults.push({ row_number: rowNumber, success: false, status: "error", message: "auditor_email es obligatorio.", run_id: null });
      continue;
    }

    const answers: ValidatedImportRow["answers"] = [];
    const answersByCode: ValidatedImportRow["answers_by_code"] = {};
    let passCount = 0;
    let naCount = 0;
    let invalidAnswer = false;

    for (let questionIndex = 0; questionIndex < questions.length; questionIndex += 1) {
      const value = cleanCell(row[4 + questionIndex]).toUpperCase();
      if (!ANSWER_VALUES.has(value)) {
        rowResults.push({
          row_number: rowNumber,
          success: false,
          status: "error",
          message: `Valor inválido en ${buildHistoricalImportQuestionCode(questionIndex)}. Usa PASS, FAIL o NA.`,
          run_id: null,
        });
        invalidAnswer = true;
        break;
      }

      if (value === "PASS") passCount += 1;
      if (value === "NA") naCount += 1;
      const questionCode = `Q__${String(questionIndex + 1).padStart(3, "0")}`;
      answersByCode[questionCode] = value as "PASS" | "FAIL" | "NA";
      answers.push({
        question_id: questions[questionIndex].id,
        answer: value as "PASS" | "FAIL" | "NA",
        result: value as "PASS" | "FAIL" | "NA",
      });
    }

    if (invalidAnswer) continue;

    const denominator = questions.length - naCount;
    if (denominator <= 0) {
      rowResults.push({ row_number: rowNumber, success: false, status: "error", message: "La fila no puede tener todas las respuestas en NA.", run_id: null });
      continue;
    }

    validatedRows.push({
      row_number: rowNumber,
      executed_at: executedAt,
      auditor_email: auditorEmail,
      team_member_employee_number: employeeNumber,
      notes,
      answers_by_code: answersByCode,
      answers,
      score: Number(((passCount / denominator) * 100).toFixed(2)),
    });
  }

  for (const row of validatedRows) {
    try {
      const created = await createHistoricalRun({
        supabaseAdmin: supabaseAdmin(),
        hotel_id: hotel.id,
        area_id: template.area_id,
        template_id: template.id,
        executed_by: actorUserId,
        executed_at: row.executed_at,
        auditor_email: row.auditor_email,
        employee_number: row.team_member_employee_number,
        notes: row.notes,
        score: row.score,
        questions: questions.map((question, index) => ({
          id: question.id,
          code: `Q__${String(index + 1).padStart(3, "0")}`,
        })),
        answers: row.answers_by_code,
      });

      rowResults.push({ row_number: row.row_number, success: true, status: "created", message: "Auditoría histórica importada.", run_id: String(created.id) });
    } catch (error) {
      rowResults.push({
        row_number: row.row_number,
        success: false,
        status: "error",
        message: error instanceof Error ? error.message : "No se pudo crear la auditoría histórica.",
        run_id: null,
      });
      continue;
    }
  }

  const failures = rowResults.filter(
    (row): row is HistoricalImportResult["failures"][number] => row.success === false,
  );

  return {
    total_rows: dataRows.length,
    imported_count: rowResults.filter((row) => row.success).length,
    failed_count: failures.length,
    failures,
    row_results: rowResults,
  };
}
