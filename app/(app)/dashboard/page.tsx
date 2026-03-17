import { requirePageAccess } from "@/lib/auth/server";

import DashboardPageClient from "./DashboardPageClient";

export default async function DashboardPage() {
  const { profile, hotelId } = await requirePageAccess({
    roles: ["admin", "general_manager", "quality", "superadmin"],
    requireHotel: true,
    nextPath: "/dashboard",
  });

  return <DashboardPageClient initialProfile={profile} initialHotelId={hotelId} />;
}
