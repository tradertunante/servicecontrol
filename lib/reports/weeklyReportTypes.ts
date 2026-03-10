export type WeeklyAreaAuditRow = {
  run_id: string;
  executed_at: string | null;
  template_name: string;
  auditor_name: string | null;
  score: number | null;
  fail: number;
  na: number;
  ok: number;
  total: number;
};

export type WeeklyAreaTopFailureRow = {
  question_id: string;
  question_text: string;
  section_name: string;
  fail_count: number;
};

export type WeeklyAreaSectionRow = {
  section_id: string;
  section_name: string;
  fail: number;
  na: number;
  ok: number;
  total: number;
};

export type WeeklyAreaReportData = {
  hotel: {
    id: string | null;
    name: string;
  };
  area: {
    id: string;
    name: string;
    type: string | null;
  };
  range: {
    week_start: string;
    week_end: string;
    label: string;
  };
  summary: {
    audit_count: number;
    avg_score: number | null;
    fail_rate_pct: number;
    fail_count: number;
    na_count: number;
    ok_count: number;
    total_answers: number;
  };
  audits: WeeklyAreaAuditRow[];
  top_failures: WeeklyAreaTopFailureRow[];
  sections: WeeklyAreaSectionRow[];
};