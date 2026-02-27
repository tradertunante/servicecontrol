// FILE: app/(app)/areas/[areaId]/_lib/areaTypes.ts
export type Role = "admin" | "manager" | "auditor" | "superadmin";

export type TabKey = "history" | "templates" | "dashboard";
export type PeriodKey = "THIS_MONTH" | "LAST_3_MONTHS" | "THIS_YEAR";

export type Area = {
  id: string;
  name: string;
  type: string | null;
  hotel_id?: string | null;
};

export type AuditTemplate = {
  id: string;
  name: string;
  active?: boolean | null;
};

export type AuditRunRow = {
  id: string;
  status: string | null;
  score: number | null;
  notes: string | null;
  executed_at: string | null;
  executed_by: string | null;
  audit_template_id: string;
  area_id: string;
};

export type AnswerRow = {
  audit_run_id: string;
  question_id: string;
  result: string | null; // PASS/FAIL/NA...
};

export type QuestionMeta = {
  id: string;
  text: string;
  audit_section_id: string;
  section_name: string;
  tag?: string | null;
  classification?: string | null;
};

export type SectionTotal = {
  section_id: string;
  section_name: string;
  total_questions: number;
};