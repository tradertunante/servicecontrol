import * as XLSX from "xlsx";

import {
  buildHistoricalImportQuestionCode,
  buildHistoricalImportHeaders,
  type HistoricalImportPreviewRow,
  type HistoricalImportQuestionReference,
  type HistoricalImportWorkbookQuestion,
} from "@/lib/superadmin/historicalImportShared";

export const HISTORICAL_IMPORT_TEMPLATE_FILE_NAME = "historical_audits_import_template.xlsx";

function normalizeText(value: unknown) {
  return String(value ?? "")
    .replace(/\u00A0/g, " ")
    .trim();
}

function normalizeHeader(value: unknown) {
  return normalizeText(value).toLowerCase();
}

export function buildHistoricalQuestionReferences(
  questions: HistoricalImportWorkbookQuestion[],
): HistoricalImportQuestionReference[] {
  return questions.map((question, index) => ({
    code: buildHistoricalImportQuestionCode(index),
    question: question.text,
    section: question.section_name || "Sin sección",
    expected_values: "PASS/FAIL/NA",
  }));
}

export function buildHistoricalImportWorkbook(questions: HistoricalImportWorkbookQuestion[]) {
  const workbook = XLSX.utils.book_new();
  const headers = buildHistoricalImportHeaders(questions.length);
  const worksheet = XLSX.utils.aoa_to_sheet([headers]);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Historical Import");

  const referenceRows = buildHistoricalQuestionReferences(questions).map((entry) => ({
    code: entry.code,
    question: entry.question,
    section: entry.section,
    expected_values: entry.expected_values,
  }));
  const referenceSheet = XLSX.utils.json_to_sheet(referenceRows, {
    header: ["code", "question", "section", "expected_values"],
  });
  XLSX.utils.book_append_sheet(workbook, referenceSheet, "Reference");

  return workbook;
}

export function parseHistoricalImportRows(
  sheetRows: unknown[][],
  questionCount: number,
) {
  const [headerRow, ...dataRows] = sheetRows;
  if (!headerRow || !headerRow.length) {
    return { ok: false as const, error: "El archivo no contiene encabezados." };
  }

  const expectedHeaders = buildHistoricalImportHeaders(questionCount);
  const normalizedExpected = expectedHeaders.map(normalizeHeader);
  const normalizedHeader = headerRow.map((value) => normalizeHeader(value));
  const hasSameLength = normalizedHeader.length === normalizedExpected.length;
  const hasSameHeaders = normalizedExpected.every(
    (header, index) => normalizedHeader[index] === header,
  );

  if (!hasSameLength || !hasSameHeaders) {
    return {
      ok: false as const,
      error: "El archivo no coincide con la plantilla esperada para este template.",
    };
  }

  const parsedRows = dataRows
    .map((row, index) => {
      const rowValues = Array.isArray(row) ? row : [];
      return {
        row_number: index + 2,
        executed_at: normalizeText(rowValues[0]),
        auditor_email: normalizeText(rowValues[1]),
        team_member_employee_number: normalizeText(rowValues[2]),
        notes: normalizeText(rowValues[3]),
      } satisfies HistoricalImportPreviewRow;
    })
    .filter((row) => Object.values(row).some((value) => String(value).trim() !== ""));

  return {
    ok: true as const,
    rows: parsedRows,
    expected_headers: expectedHeaders,
  };
}
