import { requireAuditRunScope } from "@/lib/auth/server";

import AuditRunSectionDetailPageClient from "./AuditRunSectionDetailPageClient";

export default async function AuditRunSectionDetailPage({
  params,
}: {
  params: { areaId: string; runId: string };
}) {
  await requireAuditRunScope(params.runId, {
    module: "areas",
    nextPath: `/areas/${params.areaId}/history/${params.runId}`,
    redirectTo: `/areas/${params.areaId}/history`,
  });

  return <AuditRunSectionDetailPageClient areaId={params.areaId} runId={params.runId} />;
}
