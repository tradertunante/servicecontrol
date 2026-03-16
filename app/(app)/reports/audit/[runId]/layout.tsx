import type { ReactNode } from "react";

import { requireAuditRunScope } from "@/lib/auth/server";

export default async function AuditReportLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { runId: string };
}) {
  await requireAuditRunScope(params.runId, {
    module: "reports",
    nextPath: `/reports/audit/${params.runId}`,
    redirectTo: "/areas",
  });

  return <>{children}</>;
}
