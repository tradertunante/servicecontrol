import { requireAreaScope } from "@/lib/auth/server";
import { buildWeeklyAreaReport } from "@/lib/reports/buildWeeklyAreaReport";
import { getPreviousWeekRangeFrom } from "@/lib/reports/reportRanges";

import WeeklyAreaReportPageClient from "./WeeklyAreaReportPageClient";

export default async function WeeklyAreaReportPage(
  props: {
    params: Promise<{ areaId: string }>;
    searchParams?: Promise<{ weekStart?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const auth = await requireAreaScope(params.areaId, {
    module: "reports",
    nextPath: `/reports/weekly/area/${params.areaId}`,
    redirectTo: "/areas",
  });

  const effectiveRange = getPreviousWeekRangeFrom(searchParams?.weekStart);
  const report = await buildWeeklyAreaReport({
    areaId: params.areaId,
    hotelId: auth.hotelId,
    weekStart: effectiveRange.weekStart,
    weekEnd: effectiveRange.weekEnd,
  });

  return <WeeklyAreaReportPageClient report={report} />;
}
