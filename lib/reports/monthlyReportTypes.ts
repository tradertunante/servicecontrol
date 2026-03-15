import type { AreaPeriodAuditRow, AreaPeriodSectionRow, AreaPeriodTopFailureRow } from "./areaPeriodReportTypes";

export type MonthlyAreaAuditRow = AreaPeriodAuditRow;
export type MonthlyAreaTopFailureRow = AreaPeriodTopFailureRow;
export type MonthlyAreaSectionRow = AreaPeriodSectionRow;

export type MonthlyAreaReportData = {
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
    month: string;
    month_start: string;
    month_end: string;
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
  audits: MonthlyAreaAuditRow[];
  top_failures: MonthlyAreaTopFailureRow[];
  sections: MonthlyAreaSectionRow[];
};
