import { requirePageAccess } from "@/lib/auth/server";

import AnalyticsPageClient from "./AnalyticsPageClient";

export default async function AnalyticsPage() {
  const { profile, hotelId } = await requirePageAccess({
    roles: ["admin", "manager", "superadmin"],
    requireHotel: true,
    nextPath: "/analytics",
    redirectTo: "/dashboard",
  });

  return (
    <AnalyticsPageClient
      initialProfile={profile}
      initialHotelId={hotelId}
    />
  );
}
