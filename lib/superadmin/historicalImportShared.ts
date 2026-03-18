export type HistoricalImportHotelOption = {
  id: string;
  name: string;
  active: boolean;
};

export type HistoricalImportTemplateOption = {
  id: string;
  name: string;
  area_id: string;
  area_name: string;
  active: boolean;
};

export type HistoricalImportSelectedTemplate = {
  id: string;
  name: string;
  hotel_id: string;
  area_id: string;
  area_name: string;
  question_count: number;
};

export type HistoricalImportPreviewRow = {
  row_number: number;
  executed_at: string;
  auditor_email: string;
  team_member_employee_number: string;
  notes: string;
};

export type HistoricalImportQuestionReference = {
  code: string;
  question: string;
  section: string;
  expected_values: string;
};

export type HistoricalImportWorkbookQuestion = {
  text: string;
  section_name: string;
};

export type HistoricalImportRowResult = {
  row_number: number;
  success: boolean;
  status: "created" | "error";
  message: string;
  run_id: string | null;
};

export type HistoricalImportResult = {
  total_rows: number;
  imported_count: number;
  failed_count: number;
  failures: Array<HistoricalImportRowResult & { success: false; status: "error" }>;
  row_results: HistoricalImportRowResult[];
};

export function buildHistoricalImportQuestionCode(index: number) {
  return `Q__${String(index + 1).padStart(3, "0")}`;
}

export function buildHistoricalImportHeaders(questionCount: number) {
  return [
    "executed_at",
    "auditor_email",
    "team_member_employee_number",
    "notes",
    ...Array.from({ length: questionCount }, (_, index) =>
      buildHistoricalImportQuestionCode(index),
    ),
  ];
}
