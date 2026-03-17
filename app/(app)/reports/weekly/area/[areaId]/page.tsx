import { requireAreaScope } from "@/lib/auth/server";

import WeeklyAreaReportPageClient from "./WeeklyAreaReportPageClient";

export default async function WeeklyAreaReportPage({
  params,
}: {
  params: { areaId: string };
}) {
  const auth = await requireAreaScope(params.areaId, {
    module: "reports",
    nextPath: `/reports/weekly/area/${params.areaId}`,
    redirectTo: "/areas",
  });

  return <WeeklyAreaReportPageClient areaId={params.areaId} hotelId={auth.hotelId} />;
}
