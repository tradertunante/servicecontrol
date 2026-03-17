import { requireAreaScope } from "@/lib/auth/server";

import AreaHistoryPageClient from "./AreaHistoryPageClient";

export default async function AreaHistoryPage({
  params,
}: {
  params: { areaId: string };
}) {
  const auth = await requireAreaScope(params.areaId, {
    module: "areas",
    nextPath: `/areas/${params.areaId}/history`,
    redirectTo: "/areas",
  });

  return <AreaHistoryPageClient areaId={params.areaId} initialProfile={auth.profile} />;
}
