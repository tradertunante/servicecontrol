import type { ReactNode } from "react";

import { requireAuditRunScope } from "@/lib/auth/server";

export default async function AuditReportLayout(
  props: {
    children: ReactNode;
    params: Promise<{ runId: string }>;
  }
) {
  const params = await props.params;

  const {
    children
  } = props;

  await requireAuditRunScope(params.runId, {
    module: "reports",
    nextPath: `/reports/audit/${params.runId}`,
    redirectTo: "/areas",
  });

  return <>{children}</>;
}
