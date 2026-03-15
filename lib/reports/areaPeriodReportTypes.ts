export type AreaPeriodAuditRow = {
  run_id: string;
  executed_at: string | null;
  template_name: string;
  auditor_name: string | null;
  score: number | null;
  status: string | null;
  fail: number;
  na: number;
  ok: number;
  total: number;
};

export type AreaPeriodTopFailureRow = {
  question_id: string;
  question_text: string;
  section_name: string;
  fail_count: number;
};

export type AreaPeriodSectionRow = {
  section_id: string;
  section_name: string;
  fail: number;
  na: number;
  ok: number;
  total: number;
};

export type AreaPeriodRange = {
  start: string;
  end: string;
  label: string;
};

export type AreaPeriodReportData = {
  hotel: {
    id: string | null;
    name: string;
  };
  area: {
    id: string;
    name: string;
    type: string | null;
  };
  range: AreaPeriodRange;
  summary: {
    audit_count: number;
    avg_score: number | null;
    fail_rate_pct: number;
    fail_count: number;
    na_count: number;
    ok_count: number;
    total_answers: number;
  };
  audits: AreaPeriodAuditRow[];
  top_failures: AreaPeriodTopFailureRow[];
  sections: AreaPeriodSectionRow[];
};
