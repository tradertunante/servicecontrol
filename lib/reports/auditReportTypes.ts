export type AuditReportStatus = "FAIL" | "NA" | "OK";

export type AuditReportItem = {
  question_id: string;
  question_text: string;
  section_id: string;
  section_name: string;
  status: AuditReportStatus;
  comment: string | null;
};

export type AuditReportSection = {
  section_id: string;
  section_name: string;
  total: number;
  fail: number;
  na: number;
  ok: number;
  items: AuditReportItem[];
};

export type AuditReportTimelineEvent = {
  type: string;
  label: string;
  date: string | null;
};

export type AuditReportData = {
  run: {
    id: string;
    area_id: string;
    audit_template_id: string;
    status: string | null;
    score: number | null;
    room_number: string | null;
    executed_at: string | null;
  };
  area: {
    id: string;
    name: string;
    type: string | null;
  } | null;
  template: {
    id: string;
    name: string;
  } | null;
  summary: {
    total: number;
    fail: number;
    na: number;
    ok: number;
  };
  sections: AuditReportSection[];
  timeline: AuditReportTimelineEvent[];
};
