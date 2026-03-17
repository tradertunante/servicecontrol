import { requireAreaScope } from "@/lib/auth/server";

import AreaPageClient from "./AreaPageClient";

export default async function AreaPage({
  params,
}: {
  params: { areaId: string };
}) {
  const auth = await requireAreaScope(params.areaId, {
    module: "areas",
    nextPath: `/areas/${params.areaId}`,
    redirectTo: "/areas",
  });

  return (
    <AreaPageClient
      areaId={params.areaId}
      initialProfile={auth.profile}
      initialHotelId={auth.hotelId}
    />
  );
}
