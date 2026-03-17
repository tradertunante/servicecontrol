import { getActiveHotel, requireRole } from "@/lib/auth/server";

import AnalyticsPageClient from "./AnalyticsPageClient";

export default async function AnalyticsPage() {
  const { profile } = await requireRole(["admin", "manager", "superadmin"], {
    nextPath: "/analytics",
    redirectTo: "/dashboard",
  });

  const activeHotel = await getActiveHotel(null, profile);

  return (
    <AnalyticsPageClient
      initialProfile={profile}
      initialHotelId={activeHotel.ok ? activeHotel.hotelId : null}
    />
  );
}
