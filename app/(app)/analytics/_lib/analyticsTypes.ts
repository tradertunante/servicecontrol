export type Role = "admin" | "manager" | "auditor" | "superadmin";

export type Profile = {
  id: string;
  hotel_id: string | null;
  role: Role;
  active: boolean | null;
  full_name?: string | null;
};

export type HotelRow = { id: string; name: string };

export type AreaRow = {
  id: string;
  name: string;
  type: string | null;
  hotel_id: string | null;
};

export type AuditRunRow = {
  id: string;
  executed_at: string | null;
  team_member_id: string | null;
  area_id: string;
  status: string | null;
  hotel_id: string | null;
  audit_template_id: string | null;
};

export type AnswerRowLite = {
  audit_run_id: string;
  question_id: string;
  answer: "PASS" | "FAIL" | "NA" | null;
  result: "PASS" | "FAIL" | "NA" | null;
};

export type QuestionLite = {
  id: string;
  text: string;
  tag: string | null;
  classification: string | null;
};

export type TeamMemberLite = {
  id: string;
  full_name: string;
  position: string | null;
  employee_number: string | null;
};

export type TemplateLite = { id: string; name: string };

export type Period = "30" | "60" | "90" | "365" | "custom";
export type TabKey = "ranking" | "common" | "member";

export type SortKey = "name" | "audits_count" | "fail_rate_pct" | "last_audit_at";
export type SortDir = "asc" | "desc";

export type RankingRow = {
  team_member_id: string;
  name: string;
  audits_count: number;
  answered: number;
  fails: number;
  fail_rate_pct: number | null;
  last_audit_at: string | null;
};

export type CommonStandardRow = {
  question_id: string;
  standard: string;
  tag: string | null;
  classification: string | null;
  affected_members: number;
  fail_count: number;
};

export type MemberReport = {
  audits_count: number;
  overall_fail_pct: number | null;
  by_template: Array<{
    template_id: string | null;
    template_name: string;
    audits_count: number;
    audits_pct: number;
    fail_pct: number | null;
  }>;
};

export type MemberTrendRow = {
  run_id: string;
  executed_at: string | null;
  template_name: string;
  answered: number;
  fails: number;
  fail_pct: number | null;
};

export type MemberTopStandardRow = {
  question_id: string;
  standard: string;
  tag: string | null;
  classification: string | null;
  fail_count: number;
};