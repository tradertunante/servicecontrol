import { requireAreaScope } from "@/lib/auth/server";
import { buildMonthlyAreaReport } from "@/lib/reports/buildMonthlyAreaReport";
import { getPreviousFullMonthFrom } from "@/lib/reports/reportRanges";

import MonthlyAreaReportPageClient from "./MonthlyAreaReportPageClient";

export default async function MonthlyAreaReportPage(
  props: {
    params: Promise<{ areaId: string }>;
    searchParams?: Promise<{ month?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const auth = await requireAreaScope(params.areaId, {
    module: "reports",
    nextPath: `/reports/monthly/area/${params.areaId}`,
    redirectTo: "/areas",
  });

  const effectiveMonth = getPreviousFullMonthFrom(searchParams?.month);
  const report = await buildMonthlyAreaReport({
    areaId: params.areaId,
    hotelId: auth.hotelId,
    month: effectiveMonth.month,
  });

  return <MonthlyAreaReportPageClient report={report} />;
}
