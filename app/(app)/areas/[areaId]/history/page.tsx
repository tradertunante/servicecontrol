import { requireAreaScope } from "@/lib/auth/server";

import AreaHistoryPageClient from "./AreaHistoryPageClient";

export default async function AreaHistoryPage(
  props: {
    params: Promise<{ areaId: string }>;
  }
) {
  const params = await props.params;
  const auth = await requireAreaScope(params.areaId, {
    module: "areas",
    nextPath: `/areas/${params.areaId}/history`,
    redirectTo: "/areas",
  });

  return <AreaHistoryPageClient areaId={params.areaId} initialProfile={auth.profile} />;
}
