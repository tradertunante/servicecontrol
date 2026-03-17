import { requireAreaScope } from "@/lib/auth/server";

import MonthlyAreaReportPageClient from "./MonthlyAreaReportPageClient";

export default async function MonthlyAreaReportPage({
  params,
}: {
  params: { areaId: string };
}) {
  const auth = await requireAreaScope(params.areaId, {
    module: "reports",
    nextPath: `/reports/monthly/area/${params.areaId}`,
    redirectTo: "/areas",
  });

  return <MonthlyAreaReportPageClient areaId={params.areaId} hotelId={auth.hotelId} />;
}
