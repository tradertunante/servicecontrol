import { NextRequest, NextResponse } from "next/server";
import { jsonDbError } from "@/lib/api/response";
import * as XLSX from "xlsx";

import {
  loadHistoricalImportHotelTemplates,
  loadOrderedActiveTemplateQuestions,
} from "@/lib/superadmin/historicalImports";
import { createHistoricalRun } from "@/lib/superadmin/createHistoricalRun";
import { buildHistoricalQuestionReferences, parseHistoricalImportRows } from "@/lib/superadmin/historicalImportExcel";
import { jsonError, requireSuperadminRoute } from "@/lib/superadmin/server";
import { validateSpreadsheetUpload } from "@/lib/api/validateUpload";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logger } from "@/lib/logger";

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

async function loadHotelOrError(hotelId: string) {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("hotels")
    .select("id, name, active")
    .eq("id", hotelId)
    .maybeSingle();

  if (error) return { ok: false as const, error: error.message, status: 500 };
  if (!data?.id) return { ok: false as const, error: "El hotel seleccionado no existe.", status: 404 };
  if (data.active === false) return { ok: false as const, error: "El hotel seleccionado está inactivo.", status: 409 };

  return {
    ok: true as const,
    hotel: {
      id: String(data.id),
      name: cleanCell(data.name) || "Hotel",
    },
  };
}

async function loadTemplateOrError(templateId: string, hotelId: string) {
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

  if (error) return { ok: false as const, error: error.message, status: 500 };
  if (!data?.id) return { ok: false as const, error: "El template seleccionado no pertenece al hotel.", status: 404 };
  if (data.active === false) return { ok: false as const, error: "El template seleccionado está inactivo.", status: 409 };

  const area = Array.isArray(data.areas) ? data.areas[0] ?? null : data.areas ?? null;
  if (!data.area_id || !area?.id || area.active === false) {
    return { ok: false as const, error: "El template seleccionado debe tener un área activa.", status: 409 };
  }

  return {
    ok: true as const,
    template: {
      id: String(data.id),
      name: cleanCell(data.name) || "Template",
      hotel_id: String(data.hotel_id ?? hotelId),
      area_id: String(data.area_id),
      area_name: cleanCell(area.name) || "Área",
    },
  };
}

export async function GET(request: NextRequest) {
  const caller = await requireSuperadminRoute(request);
  if (!caller) return jsonError("No autorizado.", 401);

  const hotelId = cleanCell(request.nextUrl.searchParams.get("hotel_id"));
  const templateId = cleanCell(request.nextUrl.searchParams.get("template_id"));
  const admin = supabaseAdmin();

  const { data: hotels, error: hotelsError } = await admin
    .from("hotels")
    .select("id, name, active")
    .eq("active", true)
    .order("name", { ascending: true });

  if (hotelsError) return jsonDbError(hotelsError);

  const payload: Record<string, unknown> = {
    hotels: (hotels ?? []).map((hotel) => ({
      id: String(hotel.id),
      name: cleanCell(hotel.name) || "Hotel",
      active: hotel.active !== false,
    })),
    templates: [],
    selected_hotel: null,
    selected_template: null,
    question_references: [],
  };

  if (!hotelId) {
    return NextResponse.json({ ok: true, ...payload });
  }

  const hotel = await loadHotelOrError(hotelId);
  if (!hotel.ok) return jsonError(hotel.error, hotel.status);

  let templates;
  try {
    templates = await loadHistoricalImportHotelTemplates(hotel.hotel.id);
  } catch (error) {
    return jsonDbError(error instanceof Error ? { message: error.message } : null, "No se pudieron cargar los templates.");
  }

  payload.selected_hotel = hotel.hotel;
  payload.templates = templates;

  if (!templateId) {
    return NextResponse.json({ ok: true, ...payload });
  }

  const template = await loadTemplateOrError(templateId, hotel.hotel.id);
  if (!template.ok) return jsonError(template.error, template.status);

  let questions;
  try {
    questions = await loadOrderedActiveTemplateQuestions(template.template.id);
  } catch (error) {
    return jsonDbError(error instanceof Error ? { message: error.message } : null, "No se pudieron cargar las preguntas.");
  }

  payload.selected_template = {
    ...template.template,
    question_count: questions.length,
  };
  payload.question_references = buildHistoricalQuestionReferences(questions);

  return NextResponse.json({ ok: true, ...payload });
}

export async function POST(request: NextRequest) {
  const caller = await requireSuperadminRoute(request);
  if (!caller) return jsonError("No autorizado.", 401);
  const actorUserId = String(caller.profile.id ?? "").trim();
  if (!actorUserId) return jsonError("No se pudo resolver el usuario autenticado.", 401);

  const formData = await request.formData().catch(() => null);
  const hotelId = cleanCell(formData?.get("hotel_id") ?? formData?.get("hotelId"));
  const templateId = cleanCell(formData?.get("template_id") ?? formData?.get("templateId"));
  const file = formData?.get("file");

  if (!hotelId) return jsonError("hotel_id es obligatorio.", 400);
  if (!templateId) return jsonError("template_id es obligatorio.", 400);

  const upload = await validateSpreadsheetUpload(file);
  if (!upload.ok) return upload.response;

  const hotel = await loadHotelOrError(hotelId);
  if (!hotel.ok) return jsonError(hotel.error, hotel.status);

  const template = await loadTemplateOrError(templateId, hotel.hotel.id);
  if (!template.ok) return jsonError(template.error, template.status);

  const questions = await loadOrderedActiveTemplateQuestions(template.template.id).catch((error) => {
    throw error;
  });
  if (questions.length === 0) {
    return jsonError("El template seleccionado no tiene preguntas activas.", 409);
  }

  const workbook = XLSX.read(upload.arrayBuffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return jsonError("El archivo no contiene hojas.", 400);

  const sheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    blankrows: false,
    defval: "",
    raw: false,
  });

  const parsedWorkbook = parseHistoricalImportRows(rawRows, questions.length);
  if (!parsedWorkbook.ok) return jsonError(parsedWorkbook.error, 400);

  const dataRows = (rawRows.slice(1) as unknown[][]).filter((row) =>
    (Array.isArray(row) ? row : []).some((cell) => cleanCell(cell).length > 0),
  );
  if (dataRows.length === 0) {
    return jsonError("El archivo no contiene filas de auditorías para importar.", 400);
  }

  const validatedRows: ValidatedImportRow[] = [];
  const rowResults: Array<{
    row_number: number;
    success: boolean;
    status: "created" | "error";
    message: string;
    run_id: string | null;
  }> = [];

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
          message: `Valor inválido en Q__${String(questionIndex + 1).padStart(3, "0")}. Usa PASS, FAIL o NA.`,
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
      await logger.info("historical_import_row", {
        executed_at: row.executed_at,
        auditor_email: row.auditor_email,
        employee_number: row.team_member_employee_number,
        score: row.score,
      });

      const created = await createHistoricalRun({
        supabaseAdmin: supabaseAdmin(),
        hotel_id: hotel.hotel.id,
        area_id: template.template.area_id,
        template_id: template.template.id,
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
    } catch (err) {
      rowResults.push({
        row_number: row.row_number,
        success: false,
        status: "error",
        message: err instanceof Error ? err.message : "No se pudo crear la auditoría histórica.",
        run_id: null,
      });
      continue;
    }
  }

  const failures = rowResults.filter((row) => row.success === false);
  const importedCount = rowResults.filter((row) => row.success).length;

  return NextResponse.json({
    ok: true,
    hotel_id: hotel.hotel.id,
    template_id: template.template.id,
    total_rows: dataRows.length,
    imported_count: importedCount,
    failed_count: failures.length,
    failures,
    row_results: rowResults,
  });
}
