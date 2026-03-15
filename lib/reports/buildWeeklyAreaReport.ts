import { buildAreaPeriodReport } from "./buildAreaPeriodReport";
import type { WeeklyAreaReportData } from "./weeklyReportTypes";

function formatWeekRangeLabel(weekStart: string, weekEnd: string): string {
  const start = new Date(`${weekStart}T00:00:00`);
  const end = new Date(`${weekEnd}T00:00:00`);

  const startLabel = start.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const endLabel = end.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return `${startLabel} - ${endLabel}`;
}

export async function buildWeeklyAreaReport(args: {
  areaId: string;
  weekStart: string;
  weekEnd: string;
}): Promise<WeeklyAreaReportData> {
  const { areaId, weekStart, weekEnd } = args;

  const report = await buildAreaPeriodReport({
    areaId,
    startDate: weekStart,
    endDate: weekEnd,
    rangeLabel: formatWeekRangeLabel(weekStart, weekEnd),
  });

  return {
    ...report,
    range: {
      week_start: weekStart,
      week_end: weekEnd,
      label: report.range.label,
    },
  };
}
