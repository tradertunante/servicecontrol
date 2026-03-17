import type { ReactNode } from "react";

import { requireAreaScope } from "@/lib/auth/server";

export default async function WeeklyAreaReportLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { areaId: string };
}) {
  await requireAreaScope(params.areaId, {
    module: "reports",
    nextPath: `/reports/weekly/area/${params.areaId}`,
    redirectTo: "/areas",
  });

  return <>{children}</>;
}
