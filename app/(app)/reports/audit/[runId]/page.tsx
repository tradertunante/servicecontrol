import { requireAuditRunScope } from "@/lib/auth/server";

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

  return <AuditReportPageClient runId={params.runId} hotelId={auth.hotelId} />;
}
