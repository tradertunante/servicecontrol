import "server-only";

import { buildAreaPeriodReport } from "./buildAreaPeriodReport";
import type { MonthlyAreaReportData } from "./monthlyReportTypes";

function getMonthBoundaries(month: string) {
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;

  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);

  return {
    monthStart: start.toISOString().slice(0, 10),
    monthEnd: end.toISOString().slice(0, 10),
  };
}

function formatMonthLabel(month: string): string {
  const [yearStr, monthStr] = month.split("-");
  const base = new Date(Number(yearStr), Number(monthStr) - 1, 1);

  return base.toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  });
}

export async function buildMonthlyAreaReport(args: {
  areaId: string;
  hotelId: string;
  month: string;
}): Promise<MonthlyAreaReportData> {
  const { areaId, hotelId, month } = args;
  const { monthStart, monthEnd } = getMonthBoundaries(month);

  const report = await buildAreaPeriodReport({
    areaId,
    hotelId,
    startDate: monthStart,
    endDate: monthEnd,
    rangeLabel: formatMonthLabel(month),
  });

  return {
    ...report,
    range: {
      month,
      month_start: monthStart,
      month_end: monthEnd,
      label: report.range.label,
    },
  };
}
