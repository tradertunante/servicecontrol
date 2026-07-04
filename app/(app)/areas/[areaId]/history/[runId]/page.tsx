import { requireAuditRunScope } from "@/lib/auth/server";

import AuditRunSectionDetailPageClient from "./AuditRunSectionDetailPageClient";

export default async function AuditRunSectionDetailPage(
  props: {
    params: Promise<{ areaId: string; runId: string }>;
  }
) {
  const params = await props.params;
  await requireAuditRunScope(params.runId, {
    module: "areas",
    nextPath: `/areas/${params.areaId}/history/${params.runId}`,
    redirectTo: `/areas/${params.areaId}/history`,
  });

  return <AuditRunSectionDetailPageClient areaId={params.areaId} runId={params.runId} />;
}
