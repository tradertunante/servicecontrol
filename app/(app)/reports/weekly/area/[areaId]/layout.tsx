import type { ReactNode } from "react";

import { requireAreaScope } from "@/lib/auth/server";

export default async function WeeklyAreaReportLayout(
  props: {
    children: ReactNode;
    params: Promise<{ areaId: string }>;
  }
) {
  const params = await props.params;

  const {
    children
  } = props;

  await requireAreaScope(params.areaId, {
    module: "reports",
    nextPath: `/reports/weekly/area/${params.areaId}`,
    redirectTo: "/areas",
  });

  return <>{children}</>;
}
