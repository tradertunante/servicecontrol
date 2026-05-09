import { requirePageAccess } from "@/lib/auth/server";
import { buildAnalyticsPagePayload } from "@/lib/analytics/server";

import AnalyticsPageClient from "./AnalyticsPageClient";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const { profile, hotelId } = await requirePageAccess({
    roles: ["admin", "manager", "superadmin", "general_manager", "quality"],
    requireHotel: true,
    nextPath: "/analytics",
    redirectTo: "/dashboard",
  });

  const payload = await buildAnalyticsPagePayload({
    profile: {
      id: profile.id,
      hotel_id: profile.hotel_id,
      role: profile.role as "admin" | "manager" | "superadmin" | "general_manager" | "quality",
      active: profile.active ?? null,
      full_name: profile.full_name ?? null,
    },
    hotelId,
    searchParams,
  });

  return <AnalyticsPageClient payload={payload} />;
}
