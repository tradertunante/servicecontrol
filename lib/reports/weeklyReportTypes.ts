import type {
  AreaPeriodAuditRow,
  AreaPeriodReportData,
  AreaPeriodSectionRow,
  AreaPeriodTopFailureRow,
} from "./areaPeriodReportTypes";

export type WeeklyAreaAuditRow = AreaPeriodAuditRow;
export type WeeklyAreaTopFailureRow = AreaPeriodTopFailureRow;
export type WeeklyAreaSectionRow = AreaPeriodSectionRow;

export type WeeklyAreaReportData = Omit<AreaPeriodReportData, "range"> & {
  range: {
    week_start: string;
    week_end: string;
    label: string;
  };
};
