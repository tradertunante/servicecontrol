import type { ReactNode } from "react";

import { requireAreaScope } from "@/lib/auth/server";

export default async function MonthlyAreaReportLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { areaId: string };
}) {
  await requireAreaScope(params.areaId, {
    module: "reports",
    nextPath: `/reports/monthly/area/${params.areaId}`,
    redirectTo: "/areas",
  });

  return <>{children}</>;
}
