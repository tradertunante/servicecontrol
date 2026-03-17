import { requireAuditRunScope } from "@/lib/auth/server";
import { buildAuditReportData } from "@/lib/reports/auditReport";

import AuditReportPageClient from "./AuditReportPageClient";

export default async function AuditReportPage({
  params,
}: {
  params: { runId: string };
}) {
  const auth = await requireAuditRunScope(params.runId, {
    module: "reports",
    nextPath: `/reports/audit/${params.runId}`,
    redirectTo: "/areas",
  });

  const report = await buildAuditReportData(params.runId, auth.hotelId);

  return <AuditReportPageClient report={report} />;
}
